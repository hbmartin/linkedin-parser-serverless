export const WARNING_SECTIONS = [
  'profile',
  'contact',
  'summary',
  'top_skills',
  'languages',
  'certifications',
  'volunteer_work',
  'projects',
  'publications',
  'honors_awards',
  'experience',
  'education',
] as const;

export type WarningSection = (typeof WARNING_SECTIONS)[number];
