export interface Contact {
  email?: string;
  phone?: string;
  linkedin_url?: string;
  location?: string;
}

export interface Language {
  language: string;
  proficiency: string;
}

export type ParsedProfileDatePrecision = 'year' | 'month' | 'day';

export interface ParsedProfileDate {
  iso: string;
  precision: ParsedProfileDatePrecision;
  text: string;
}

interface ParsedDateRangeBase {
  originalText: string;
  start: ParsedProfileDate;
  durationText?: string;
}

export type ParsedDateRange =
  | (ParsedDateRangeBase & {
      kind: 'current';
      end?: undefined;
    })
  | (ParsedDateRangeBase & {
      kind: 'completed';
      end: ParsedProfileDate;
    })
  | (ParsedDateRangeBase & {
      kind: 'single';
      end?: undefined;
    });

export interface Experience {
  title: string;
  company: string;
  duration: string;
  dates?: ParsedDateRange;
  location?: string;
  description?: string;
}

export interface Education {
  degree: string;
  institution: string;
  year?: string;
  dates?: ParsedDateRange;
  location?: string;
  description?: string;
}

export interface LinkedInProfile {
  name?: string;
  headline?: string;
  location?: string;
  contact: Contact;
  top_skills: string[];
  languages: Language[];
  certifications: string[];
  volunteer_work: string[];
  projects: string[];
  publications: string[];
  summary?: string;
  experience: Experience[];
  education: Education[];
}

export interface ParseOptions {
  includeRawText?: boolean;
}

export interface MissingProfileFieldWarning {
  code: 'missing_profile_field';
  field: 'profile.name' | 'profile.contact.email';
  message: string;
}

export type WarningSection =
  | 'profile'
  | 'contact'
  | 'summary'
  | 'top_skills'
  | 'languages'
  | 'certifications'
  | 'volunteer_work'
  | 'projects'
  | 'publications'
  | 'experience'
  | 'education';

export interface SectionParseWarning {
  code: 'section_parse_warning';
  section: WarningSection;
  entry?: number;
  field: string;
  message: string;
  rawText?: string;
}

export type ParseWarning = MissingProfileFieldWarning | SectionParseWarning;

export interface ParseResult {
  profile: LinkedInProfile;
  warnings: ParseWarning[];
  rawText?: string;
}

export interface ParsedSectionResult<T> {
  value: T;
  warnings: SectionParseWarning[];
}
