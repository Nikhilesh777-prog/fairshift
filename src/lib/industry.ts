import type { Industry } from './types';

export const INDUSTRIES: Record<Industry, { label: string; shortLabel: string; venue: string; area: string; teamLabel: string; zones: string[]; hazards: string[]; shiftTemplates: string[]; emergency: string }> = {
  construction: {
    label: 'Construction Site', shortLabel: 'Construction', venue: 'Site', area: 'Site zone', teamLabel: 'Crew',
    zones: ['North scaffolding', 'Tower B', 'Loading bay', 'Ground works'],
    hazards: ['Scaffolding', 'PPE', 'Electrical', 'Heavy machinery', 'Other'],
    shiftTemplates: ['Day crew · 07:00–15:00', 'Evening crew · 15:00–23:00', 'Night crew · 23:00–07:00'],
    emergency: '+1-800-555-0199',
  },
  campus: {
    label: 'College-Campus', shortLabel: 'Campus', venue: 'Campus', area: 'Department', teamLabel: 'Team',
    zones: ['Library', 'Science labs', 'Student services', 'Facilities'],
    hazards: ['Wet floors', 'Lab safety', 'Fire exits', 'Electrical', 'Other'],
    shiftTemplates: ['Morning staff · 06:00–14:00', 'Day staff · 09:00–17:00', 'Evening staff · 14:00–22:00'],
    emergency: '+1-800-555-0112',
  },
};
