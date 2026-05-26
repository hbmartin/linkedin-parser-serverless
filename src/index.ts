import { ExperienceStructuralParser } from './parsers/experience-structural.js';
import { BasicInfoParser } from './parsers/basic-info.js';
import { ListParser } from './parsers/lists.js';
import { EducationParser } from './parsers/education.js';
import { ExtraSectionParser } from './parsers/extra-sections.js';
import { IdentityStructuralParser } from './parsers/identity-structural.js';
import { extractLinkedInPDFSourceDebug } from './pdf-source-debug.js';
import { createParseDiagnostics } from './diagnostics.js';
import {
  LinkedInProfileParseError,
  createLinkedInProfileParseError,
  normalizeLinkedInProfileParseError,
} from './errors.js';
import { formatLinkedInProfile } from './formatter.js';
import { ParseResultSchema } from './schemas.js';
import { cleanPDFText } from './utils/text-utils.js';
import type { LayoutInfo, TextItem } from './types/structural.js';
import type {
  Contact,
  Experience,
  ExperienceGroup,
  LinkedInProfile,
  ParseOptions,
  ParseResult,
  ParseWarning,
  SectionParseWarning,
} from './types/profile.js';
import type { StructuralLine } from './utils/structural-lines.js';

export type {
  Contact,
  ContactLink,
  Education,
  Experience,
  ExperienceGroup,
  ExperienceGroupPosition,
  Language,
  LinkedInProfile,
  MissingProfileFieldWarning,
  ParseOptions,
  ParseResult,
  ParseWarning,
  ParsedDateRange,
  ParsedProfileDate,
  ParsedProfileDatePrecision,
  ParseDiagnostics,
  SectionParseWarning,
  WarningSection,
} from './types/profile.js';
export type { FormatLinkedInProfileOptions } from './formatter.js';
export type { LinkedInProfileParseErrorCode } from './errors.js';
export {
  LinkedInProfileParseError,
  createLinkedInProfileParseError,
  formatLinkedInProfile,
};
export type { LinkedInPDFSourceDebugArtifacts } from './pdf-source-debug.js';
export {
  ContactSchema,
  ContactLinkSchema,
  EducationSchema,
  ExperienceSchema,
  ExperienceGroupPositionSchema,
  ExperienceGroupSchema,
  LanguageSchema,
  LinkedInProfileSchema,
  ParseDiagnosticsSchema,
  ParseResultSchema,
  ParseWarningSchema,
  ParsedDateRangeSchema,
  ParsedProfileDateSchema,
} from './schemas.js';
export { extractLinkedInPDFSourceDebug } from './pdf-source-debug.js';

export type SafeParseLinkedInPDFResult =
  | {
      data: ParseResult;
      success: true;
    }
  | {
      error: LinkedInProfileParseError;
      success: false;
    };

/**
 * Parses a LinkedIn PDF resume and extracts structured profile data
 * @param input - PDF binary data or extracted text string
 * @param options - Optional parsing configuration
 * @returns Promise resolving to structured LinkedIn profile data
 */
export async function parseLinkedInPDF(
  input: ArrayBuffer | Uint8Array | string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  try {
    return await parseLinkedInPDFInternal(input, options);
  } catch (cause) {
    throw normalizeLinkedInProfileParseError({
      cause,
      inputKind: typeof input === 'string' ? 'text' : 'pdf',
    });
  }
}

export async function parseLinkedInPDFStrict(
  input: ArrayBuffer | Uint8Array | string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const result = await parseLinkedInPDF(input, options);
  const parsedResult = ParseResultSchema.safeParse(result);

  if (!parsedResult.success) {
    throw createLinkedInProfileParseError({
      cause: parsedResult.error,
      code: 'schema_validation_failed',
    });
  }

  return parsedResult.data;
}

export async function safeParseLinkedInPDF(
  input: ArrayBuffer | Uint8Array | string,
  options: ParseOptions = {}
): Promise<SafeParseLinkedInPDFResult> {
  try {
    return {
      data: await parseLinkedInPDFStrict(input, options),
      success: true,
    };
  } catch (cause) {
    return {
      error: normalizeLinkedInProfileParseError({
        cause,
        inputKind: typeof input === 'string' ? 'text' : 'pdf',
      }),
      success: false,
    };
  }
}

async function parseLinkedInPDFInternal(
  input: ArrayBuffer | Uint8Array | string,
  options: ParseOptions
): Promise<ParseResult> {
  let text: string;
  let structuralData: {
    layout: LayoutInfo;
    structuralLines: StructuralLine[];
    textItems: TextItem[];
  } | null = null;

  // Handle both binary PDF data and extracted text inputs
  if (typeof input !== 'string') {
    try {
      const debugArtifacts = await extractLinkedInPDFSourceDebug(input);

      structuralData = {
        layout: debugArtifacts.layout,
        structuralLines: debugArtifacts.structuralLines,
        textItems: debugArtifacts.textItems,
      };
      text = debugArtifacts.rawText;
    } catch (cause) {
      throw normalizeLinkedInProfileParseError({
        cause,
        inputKind: 'pdf',
      });
    }
  } else {
    text = input;
  }

  if (!text || text.length < 50) {
    throw createLinkedInProfileParseError({
      code: 'text_extraction_failed',
    });
  }

  // Clean and parse the text
  const cleanedText = cleanPDFText(text);
  const sectionWarnings: SectionParseWarning[] = [];
  const structuralLines = structuralData?.structuralLines;

  // Parse all sections using specialized parsers
  const basicInfoResult = structuralLines
    ? BasicInfoParser.parseStructuralWithWarnings(cleanedText, structuralLines)
    : BasicInfoParser.parseWithWarnings(cleanedText);
  const basicInfo = basicInfoResult.value;
  sectionWarnings.push(...basicInfoResult.warnings);

  const structuralIdentityResult = structuralLines
    ? IdentityStructuralParser.parseWithWarnings(structuralLines)
    : undefined;
  const structuralIdentity = structuralIdentityResult?.value;

  if (structuralIdentityResult) {
    sectionWarnings.push(...structuralIdentityResult.warnings);
  }

  const topSkillsResult = structuralIdentity?.topSkills.length
    ? undefined
    : ListParser.parseSkillsWithWarnings(cleanedText);
  const topSkills = structuralIdentity?.topSkills.length
    ? structuralIdentity.topSkills
    : (topSkillsResult?.value ?? []);

  if (topSkillsResult) {
    sectionWarnings.push(...topSkillsResult.warnings);
  }

  const languagesResult = structuralLines
    ? ListParser.parseStructuralLanguagesWithWarnings(structuralLines)
    : ListParser.parseLanguagesWithWarnings(cleanedText);
  const languages = languagesResult.value;
  sectionWarnings.push(...languagesResult.warnings);

  const extraSectionsResult = structuralLines
    ? ExtraSectionParser.parseStructuralWithWarnings(structuralLines)
    : ExtraSectionParser.parseTextWithWarnings(cleanedText);
  const extraSections = extraSectionsResult.value;
  sectionWarnings.push(...extraSectionsResult.warnings);

  // Use structural parser for experience if available, otherwise fallback
  let experience: Experience[];
  let experienceGroups: ExperienceGroup[];
  if (structuralData) {
    const workExperienceResult =
      ExperienceStructuralParser.parseExperienceWithWarnings(
        structuralData.textItems
      );
    const workExperiences = workExperienceResult.value;
    sectionWarnings.push(...workExperienceResult.warnings);

    // Convert WorkExperience[] to Experience[] for compatibility
    experience = workExperiences.flatMap(workExp =>
      workExp.positions.map(position => ({
        ...(position.dates ? { dates: position.dates } : {}),
        title: position.title,
        company: workExp.organization,
        duration: position.duration,
        location: position.location,
        description: position.description,
      }))
    );

    experienceGroups = workExperiences.map(workExp => ({
      company: workExp.organization,
      positions: workExp.positions.map(position => ({
        ...(position.dates ? { dates: position.dates } : {}),
        title: position.title,
        duration: position.duration,
        location: position.location,
        description: position.description,
      })),
      ...(workExp.totalDuration
        ? { totalDuration: workExp.totalDuration }
        : {}),
    }));
  } else {
    // Fallback to old parser for string inputs
    const { ExperienceParser } = await import('./parsers/experience.js');
    const experienceResult = ExperienceParser.parseWithWarnings(cleanedText);
    experience = experienceResult.value;
    sectionWarnings.push(...experienceResult.warnings);
    experienceGroups = groupFlatExperiences(experience);
  }

  const structuralEducationResult = structuralLines
    ? EducationParser.parseStructuralWithWarnings(structuralLines)
    : undefined;
  const fallbackEducationResult =
    !structuralEducationResult || structuralEducationResult.value.length === 0
      ? EducationParser.parseWithWarnings(cleanedText)
      : undefined;
  const education =
    structuralEducationResult && structuralEducationResult.value.length > 0
      ? structuralEducationResult.value
      : (fallbackEducationResult?.value ?? []);

  if (structuralEducationResult) {
    sectionWarnings.push(...structuralEducationResult.warnings);
  }

  if (fallbackEducationResult) {
    sectionWarnings.push(...fallbackEducationResult.warnings);
  }

  const contact: Contact = {
    ...basicInfo.contact,
  };

  if (structuralIdentity?.linkedinUrl) {
    contact.linkedin_url = structuralIdentity.linkedinUrl;
  }

  if (
    contact.phone &&
    contact.linkedin_url?.includes(contact.phone.replace(/\D/g, ''))
  ) {
    delete contact.phone;
  }

  // Combine into final profile
  const profile: LinkedInProfile = {
    name: structuralIdentity?.name ?? basicInfo.name,
    headline: structuralIdentity?.headline ?? basicInfo.headline,
    location: structuralIdentity?.location ?? basicInfo.location,
    contact,
    top_skills: topSkills,
    languages,
    certifications: extraSections.certifications,
    volunteer_work: extraSections.volunteer_work,
    projects: extraSections.projects,
    publications: extraSections.publications,
    honors_awards: extraSections.honors_awards,
    summary: basicInfo.summary,
    experience_groups: experienceGroups,
    experience,
    education,
  };

  const warnings = [
    ...createParseWarnings(profile),
    ...filterResolvedSectionWarnings(sectionWarnings, contact),
  ];
  const result: ParseResult = {
    profile,
    warnings,
    diagnostics: createParseDiagnostics({
      profile,
      text: cleanedText,
      warnings,
    }),
  };

  if (options.includeRawText) {
    result.rawText = text;
  }

  return result;
}

function groupFlatExperiences(experience: Experience[]): ExperienceGroup[] {
  const groups: ExperienceGroup[] = [];

  for (const entry of experience) {
    const currentGroup = groups.at(-1);
    const position = {
      ...(entry.dates ? { dates: entry.dates } : {}),
      title: entry.title,
      duration: entry.duration,
      location: entry.location,
      description: entry.description,
    };

    if (currentGroup?.company === entry.company) {
      currentGroup.positions.push(position);
      continue;
    }

    groups.push({
      company: entry.company,
      positions: [position],
    });
  }

  return groups;
}

function filterResolvedSectionWarnings(
  warnings: SectionParseWarning[],
  contact: Contact
): SectionParseWarning[] {
  return warnings.filter(warning => {
    if (
      warning.section === 'contact' &&
      warning.field === 'contact' &&
      (contact.email || contact.phone || contact.linkedin_url)
    ) {
      return false;
    }

    return true;
  });
}

function createParseWarnings(profile: LinkedInProfile): ParseWarning[] {
  const warnings: ParseWarning[] = [];

  if (!profile.name) {
    warnings.push({
      code: 'missing_profile_field',
      field: 'profile.name',
      message: 'Could not extract profile name',
    });
  }

  if (!profile.contact.email) {
    warnings.push({
      code: 'missing_profile_field',
      field: 'profile.contact.email',
      message: 'Could not extract contact email',
    });
  }

  return warnings;
}
