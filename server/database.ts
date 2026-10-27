import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

export const pool: Pool | null = process.env.DATABASE_URL ? mysql.createPool(process.env.DATABASE_URL) : null;

export async function rows<T extends RowDataPacket[]>(sql: string, values: any[] = []): Promise<T> {
  if (!pool) throw new Error('Managed database is not configured.');
  const [result] = await pool.query<T>(sql, values);
  return result;
}
export async function exec(sql: string, values: any[] = []): Promise<ResultSetHeader> {
  if (!pool) throw new Error('Managed database is not configured.');
  const [result] = await pool.execute<ResultSetHeader>(sql, values);
  return result;
}
export async function inTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  if (!pool) throw new Error('Managed database is not configured.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

const schema = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(36) PRIMARY KEY, industry VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, display_name VARCHAR(120) NOT NULL, team VARCHAR(80) NOT NULL,
    wage_cents INT NOT NULL DEFAULT 2400, share_token VARCHAR(64) NOT NULL UNIQUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX employee_org_team (organization_id, team), CONSTRAINT employee_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, username VARCHAR(80) NOT NULL UNIQUE,
    role VARCHAR(12) NOT NULL, password_hash VARCHAR(180) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX session_expiry (expires_at),
    CONSTRAINT session_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(36) PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL,
    checked_in_at DATETIME NULL, checked_out_at DATETIME NULL, location_label VARCHAR(120) NOT NULL,
    regular_hours DECIMAL(6,2) NOT NULL DEFAULT 0, overtime_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
    INDEX shift_employee_start (employee_id, starts_at), CONSTRAINT shift_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS payslips (
    id VARCHAR(36) PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL,
    base_cents INT NOT NULL, overtime_hours DECIMAL(6,2) NOT NULL, overtime_rate_cents INT NOT NULL,
    deductions_cents INT NOT NULL, net_cents INT NOT NULL, change_cents INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX pay_employee_period (employee_id, period_end),
    CONSTRAINT payslip_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS safety_reports (
    id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, employee_id VARCHAR(36) NOT NULL,
    category VARCHAR(60) NOT NULL, title VARCHAR(160) NOT NULL, details TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    team VARCHAR(80) NOT NULL, location VARCHAR(120) NOT NULL, assignee VARCHAR(120) NULL, photo_data MEDIUMTEXT NULL,
    comments_json JSON NOT NULL, created_at DATETIME NOT NULL, INDEX safety_org_status (organization_id, status, created_at),
    CONSTRAINT safety_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT safety_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS feedback (
    id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, team VARCHAR(80) NOT NULL,
    manager_rating TINYINT NOT NULL, conditions_rating TINYINT NOT NULL, comment VARCHAR(500) NULL,
    created_at DATETIME NOT NULL, INDEX feedback_org_team (organization_id, team, created_at),
    CONSTRAINT feedback_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(36) PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, title VARCHAR(140) NOT NULL, issuer VARCHAR(140) NOT NULL,
    completed_on DATE NOT NULL, verified TINYINT(1) NOT NULL DEFAULT 0, shareable TINYINT(1) NOT NULL DEFAULT 1,
    INDEX skill_employee (employee_id), CONSTRAINT skill_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS mood_checkins (
    id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, team VARCHAR(80) NOT NULL,
    mood VARCHAR(16) NOT NULL, checkin_day DATE NOT NULL, INDEX mood_org_day (organization_id, checkin_day),
    CONSTRAINT mood_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS feedback_participant_receipts (
    participant_key CHAR(64) NOT NULL, organization_id VARCHAR(36) NOT NULL, team VARCHAR(80) NOT NULL, period CHAR(7) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (participant_key, period),
    INDEX feedback_receipt_group (organization_id, team, period),
    CONSTRAINT feedback_receipt_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS mood_participant_receipts (
    participant_key CHAR(64) NOT NULL, organization_id VARCHAR(36) NOT NULL, team VARCHAR(80) NOT NULL, checkin_day DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (participant_key, checkin_day),
    INDEX mood_receipt_group (organization_id, team, checkin_day),
    CONSTRAINT mood_receipt_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(80) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, digest] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export function anonymousParticipantKey(domain: 'feedback' | 'mood', organizationId: string, team: string, employeeId: string) {
  const secret = process.env.FAIRSHIFT_ANON_SECRET || process.env.MANUS_JWT_SECRET;
  if (!secret) throw new Error('Anonymous participation protection is unavailable.');
  return createHmac('sha256', secret).update(`${domain}:${organizationId}:${team}:${employeeId}`).digest('hex');
}
const id = () => randomUUID();
const safeDateTime = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');
const safeDate = (date: Date) => date.toISOString().slice(0, 10);
const dateAt = (offset: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date;
};

async function seed() {
  if (!pool) return;
  const [orgCountRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM organizations');
  if (Number(orgCountRows[0]?.total ?? 0) > 0) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const sectors = [
      { id: 'org-construction', industry: 'construction', name: 'Northstar Construction Site', area: 'North scaffolding' },
      { id: 'org-campus', industry: 'campus', name: 'Meadowview College Campus', area: 'Science labs' },
    ];
    for (const sector of sectors) {
      await connection.execute('INSERT INTO organizations (id, industry, name) VALUES (?, ?, ?)', [sector.id, sector.industry, sector.name]);
      const names = ['Asha Patel', 'Mateo Rivera', 'Priya Shah', 'Omar Hassan', 'Lina Chen', 'Grace Mensah', 'Arun Kumar', 'Sofia Alvarez', 'Dev Nair', 'Nadia Ali', 'Sam Taylor', 'Jordan Lee'];
      const teams = ['Team A', 'Team A', 'Team A', 'Team A', 'Team A', 'Team A', 'Team B', 'Team B', 'Team B', 'Team B', 'Team B', 'Team B'];
      const employees: Array<{ id: string; name: string; team: string; wage: number; token: string }> = [];
      for (let index = 0; index < names.length; index += 1) {
        const employee = { id: `${sector.id}-emp-${String(index + 1).padStart(2, '0')}`, name: names[index]!, team: teams[index]!, wage: 2200 + (index % 4) * 150, token: randomBytes(24).toString('base64url') };
        employees.push(employee);
        await connection.execute('INSERT INTO employees (id, organization_id, display_name, team, wage_cents, share_token) VALUES (?, ?, ?, ?, ?, ?)', [employee.id, sector.id, employee.name, employee.team, employee.wage, employee.token]);
      }
      const demo = sector.industry === 'construction'
        ? [{ employee: employees[0]!, role: 'worker', username: 'worker.build', password: 'ShiftReady8!' }, { employee: employees[11]!, role: 'admin', username: 'admin.build', password: 'FairTeam8!' }]
        : [{ employee: employees[6]!, role: 'worker', username: 'worker.campus', password: 'ShiftReady8!' }, { employee: employees[5]!, role: 'admin', username: 'admin.campus', password: 'FairTeam8!' }];
      for (const account of demo) {
        await connection.execute('INSERT INTO users (id, employee_id, username, role, password_hash) VALUES (?, ?, ?, ?, ?)', [id(), account.employee.id, account.username, account.role, hashPassword(account.password)]);
      }
      for (let employeeIndex = 0; employeeIndex < employees.length; employeeIndex += 1) {
        const employee = employees[employeeIndex]!;
        for (let offset = -23; offset <= 6; offset += 1) {
          const day = dateAt(offset, 0);
          if (day.getDay() === 0 || day.getDay() === 6) continue;
          const start = dateAt(offset, sector.industry === 'construction' ? 7 + employeeIndex % 3 : 6 + employeeIndex % 4);
          const plannedOvertime = offset % 6 === 0 || (employeeIndex % 4 === 2 && offset % 3 === 0) ? 1.5 : 0;
          const end = new Date(start.getTime() + (8 + plannedOvertime) * 3_600_000);
          let checkedIn: Date | null = null;
          let checkedOut: Date | null = null;
          if (offset < 0) { checkedIn = new Date(start.getTime() + 4 * 60_000); checkedOut = new Date(end.getTime() - 8 * 60_000); }
          const actualHours = checkedIn && checkedOut ? (checkedOut.getTime() - checkedIn.getTime()) / 3_600_000 : 0;
          const regularHours = Math.min(8, Math.max(0, actualHours));
          const overtimeHours = Math.max(0, actualHours - 8);
          await connection.execute(
            'INSERT INTO shifts (id, employee_id, starts_at, ends_at, checked_in_at, checked_out_at, location_label, regular_hours, overtime_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id(), employee.id, safeDateTime(start), safeDateTime(end), checkedIn ? safeDateTime(checkedIn) : null, checkedOut ? safeDateTime(checkedOut) : null, sector.area, regularHours, overtimeHours],
          );
        }
        for (let period = 0; period < 2; period += 1) {
          const end = new Date(); end.setMonth(end.getMonth() - period, 1);
          const start = new Date(end.getFullYear(), end.getMonth(), 1);
          const net = 3_100_00 + (employeeIndex % 4) * 22_500 - period * 85_00;
          await connection.execute(
            'INSERT INTO payslips (id, employee_id, period_start, period_end, base_cents, overtime_hours, overtime_rate_cents, deductions_cents, net_cents, change_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id(), employee.id, safeDate(start), safeDate(end), 2_950_00, 8 + employeeIndex % 5, Math.round(employee.wage * 1.5), 18_500, net, period === 0 ? (employeeIndex % 2 ? -7_500 : 9_000) : 0],
          );
        }
        const certs = sector.industry === 'construction' ? ['Site safety induction', 'Working at heights'] : ['First aid basics', 'Campus fire safety'];
        for (let skillIndex = 0; skillIndex < 2; skillIndex += 1) {
          const completed = new Date(); completed.setMonth(completed.getMonth() - 2 - skillIndex);
          await connection.execute('INSERT INTO skills (id, employee_id, title, issuer, completed_on, verified, shareable) VALUES (?, ?, ?, ?, ?, ?, 1)', [id(), employee.id, certs[skillIndex], sector.name, safeDate(completed), skillIndex === 0 ? 1 : employeeIndex % 2]);
        }
      }
      const hazardList = sector.industry === 'construction' ? ['Scaffolding', 'PPE', 'Electrical', 'Heavy machinery', 'PPE', 'Scaffolding'] : ['Wet floors', 'Lab safety', 'Fire exits', 'Wet floors', 'Lab safety', 'Fire exits'];
      const reportStates = ['submitted', 'seen', 'in_progress', 'resolved', 'submitted', 'in_progress'];
      const reportTitles = sector.industry === 'construction'
        ? ['Guardrail needs attention', 'PPE stock running low', 'Cable crossing walkway', 'Lifting plan confirmed', 'Harness check requested', 'Forklift route blocked']
        : ['Water near east entrance', 'Eye-wash station check', 'Fire exit signage dim', 'Lab spill kit restocked', 'Wet floor by library', 'Door closer needs repair'];
      for (let i = 0; i < hazardList.length; i += 1) {
        const created = dateAt(-((i * 2) % 12), 9);
        await connection.execute(
          'INSERT INTO safety_reports (id, organization_id, employee_id, category, title, details, status, team, location, assignee, photo_data, comments_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
          [id(), sector.id, employees[i % 10]!.id, hazardList[i], reportTitles[i], 'Please take a look when it is safe to do so. The team has marked the area.', reportStates[i], employees[i % 10]!.team, sector.area, i % 2 ? 'Site lead Morgan' : null, JSON.stringify(i > 1 ? [{ id: id(), text: 'Thanks — this is on the team list for today.', author: 'Safety lead', createdAt: safeDateTime(dateAt(-Math.max(0, (i * 2) % 6), 10)) }] : []), safeDateTime(created)],
        );
      }
      const feedbackComments = ['Clear handover makes the day easier.', 'Would appreciate more water breaks in the afternoon.', 'Good support when I raised a concern.', 'Shift changes could be shared a little earlier.', 'Tools and training are improving.', 'The team checks in on one another.'];
      for (let i = 0; i < 12; i += 1) {
        const created = dateAt(-((i * 2) % 28), 12);
        const employee = employees[i]!;
        const period = safeDate(created).slice(0, 7);
        const participantKey = anonymousParticipantKey('feedback', sector.id, '', employee.id);
        await connection.execute('INSERT IGNORE INTO feedback_participant_receipts (participant_key, organization_id, team, period) VALUES (?, ?, ?, ?)', [participantKey, sector.id, employee.team, period]);
        await connection.execute('INSERT INTO feedback (id, organization_id, team, manager_rating, conditions_rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id(), sector.id, employee.team, 3 + (i % 3), 3 + ((i + 1) % 3), feedbackComments[i % feedbackComments.length], safeDateTime(created)]);
      }
      const moods = ['good', 'okay', 'good', 'tired', 'good', 'great', 'okay', 'good', 'tired', 'great', 'okay', 'good'];
      for (let i = 0; i < moods.length; i += 1) {
        const employee = employees[i]!;
        const checkinDay = safeDate(dateAt(-(i % 7), 0));
        const participantKey = anonymousParticipantKey('mood', sector.id, '', employee.id);
        await connection.execute('INSERT IGNORE INTO mood_participant_receipts (participant_key, organization_id, team, checkin_day) VALUES (?, ?, ?, ?)', [participantKey, sector.id, employee.team, checkinDay]);
        await connection.execute('INSERT INTO mood_checkins (id, organization_id, team, mood, checkin_day) VALUES (?, ?, ?, ?, ?)', [id(), sector.id, employee.team, moods[i], checkinDay]);
      }
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function migrateAndSeed() {
  if (!pool) return { persistent: false, seeded: false };
  await pool.query(schema[schema.length - 1]!);
  const [rowsFound] = await pool.query<RowDataPacket[]>('SELECT version FROM schema_migrations WHERE version = ?', ['001_fairshift_core']);
  if (!rowsFound.length) {
    for (const statement of schema.slice(0, -1)) await pool.query(statement);
    await pool.execute('INSERT INTO schema_migrations (version) VALUES (?)', ['001_fairshift_core']);
  }
  await pool.query(schema[schema.length - 3]!);
  await pool.query(schema[schema.length - 2]!);
  await pool.execute('INSERT IGNORE INTO schema_migrations (version) VALUES (?)', ['003_anonymous_participant_receipts']);
  const before = await rows<RowDataPacket[]>('SELECT COUNT(*) AS total FROM organizations');
  const wasEmpty = Number(before[0]?.total ?? 0) === 0;
  if (wasEmpty) await seed();
  const [tokenMigration] = await pool.query<RowDataPacket[]>('SELECT version FROM schema_migrations WHERE version = ?', ['002_private_passport_tokens']);
  if (!tokenMigration.length) {
    const employees = await rows<RowDataPacket[]>('SELECT id FROM employees');
    for (const employee of employees) await exec('UPDATE employees SET share_token = ? WHERE id = ?', [randomBytes(24).toString('base64url'), String(employee.id)]);
    await exec('INSERT INTO schema_migrations (version) VALUES (?)', ['002_private_passport_tokens']);
  }
  return { persistent: true, seeded: wasEmpty };
}
