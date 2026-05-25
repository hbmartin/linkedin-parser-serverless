import { z } from 'zod';

export const ContactLinkSchema = z.object({
  label: z.string().optional(),
  rawText: z.string(),
  url: z.string(),
});

export const ContactSchema = z.object({
  email: z.string().optional(),
  linkedin_url: z.string().optional(),
  links: z.array(ContactLinkSchema).optional(),
  location: z.string().optional(),
  phone: z.string().optional(),
});

export const LanguageSchema = z.object({
  language: z.string(),
  proficiency: z.string(),
});

export const ParsedProfileDateSchema = z.object({
  iso: z.string(),
  precision: z.enum(['year', 'month', 'day']),
  text: z.string(),
});

const ParsedDateRangeBaseSchema = z.object({
  durationText: z.string().optional(),
  originalText: z.string(),
  start: ParsedProfileDateSchema,
});

export const ParsedDateRangeSchema = z.discriminatedUnion('kind', [
  ParsedDateRangeBaseSchema.extend({
    end: z.undefined().optional(),
    kind: z.literal('current'),
  }),
  ParsedDateRangeBaseSchema.extend({
    end: ParsedProfileDateSchema,
    kind: z.literal('completed'),
  }),
  ParsedDateRangeBaseSchema.extend({
    end: z.undefined().optional(),
    kind: z.literal('single'),
  }),
]);

export const ExperienceSchema = z.object({
  company: z.string(),
  dates: ParsedDateRangeSchema.optional(),
  description: z.string().optional(),
  duration: z.string(),
  location: z.string().optional(),
  title: z.string(),
});

export const ExperienceGroupPositionSchema = ExperienceSchema.omit({
  company: true,
});

export const ExperienceGroupSchema = z.object({
  company: z.string(),
  positions: z.array(ExperienceGroupPositionSchema),
  totalDuration: z.string().optional(),
});

export const EducationSchema = z.object({
  dates: ParsedDateRangeSchema.optional(),
  degree: z.string(),
  description: z.string().optional(),
  institution: z.string(),
  location: z.string().optional(),
  year: z.string().optional(),
});

export const LinkedInProfileSchema = z.object({
  certifications: z.array(z.string()),
  contact: ContactSchema,
  education: z.array(EducationSchema),
  experience: z.array(ExperienceSchema),
  experience_groups: z.array(ExperienceGroupSchema),
  headline: z.string().optional(),
  honors_awards: z.array(z.string()),
  languages: z.array(LanguageSchema),
  location: z.string().optional(),
  name: z.string().optional(),
  projects: z.array(z.string()),
  publications: z.array(z.string()),
  summary: z.string().optional(),
  top_skills: z.array(z.string()),
  volunteer_work: z.array(z.string()),
});

const MissingProfileFieldWarningSchema = z.object({
  code: z.literal('missing_profile_field'),
  field: z.enum(['profile.name', 'profile.contact.email']),
  message: z.string(),
});

const SectionParseWarningSchema = z.object({
  code: z.literal('section_parse_warning'),
  entry: z.number().int().nonnegative().optional(),
  field: z.string(),
  message: z.string(),
  rawText: z.string().optional(),
  section: z.enum([
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
  ]),
});

export const ParseWarningSchema = z.union([
  MissingProfileFieldWarningSchema,
  SectionParseWarningSchema,
]);

export const ParseResultSchema = z.object({
  profile: LinkedInProfileSchema,
  rawText: z.string().optional(),
  warnings: z.array(ParseWarningSchema),
});
