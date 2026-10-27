export interface ShiftHours { regularHours: number; overtimeHours: number; }

/** Split actual work at the smaller of the shift's scheduled duration and the eight-hour daily threshold. */
export function splitShiftHours(actualHours: number, scheduledHours: number): ShiftHours {
  const actual = Math.max(0, Number.isFinite(actualHours) ? actualHours : 0);
  const scheduled = Math.max(0, Number.isFinite(scheduledHours) ? scheduledHours : 0);
  const regularLimit = Math.min(8, scheduled);
  const regularHours = Math.min(regularLimit, actual);
  return {
    regularHours: Number(regularHours.toFixed(2)),
    overtimeHours: Number(Math.max(0, actual - regularLimit).toFixed(2)),
  };
}
