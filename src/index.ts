import { StructuralParser } from './parsers/structural-parser.js';
import { ExperienceStructuralParser } from './parsers/experience-structural.js';
import { BasicInfoParser } from './parsers/basic-info.js';
import { ListParser } from './parsers/lists.js';
import { EducationParser } from './parsers/education.js';
import { ExtraSectionParser } from './parsers/extra-sections.js';
import { IdentityStructuralParser } from './parsers/identity-structural.js';
import { cleanPDFText } from './utils/text-utils.js';
import { createStructuralLines } from './utils/structural-lines.js';
import type { LayoutInfo, TextItem } from './types/structural.js';
import type {
  Contact,
  Experience,
  LinkedInProfile,
  ParseOptions,
  ParseResult,
  ParseWarning,
  SectionParseWarning,
} from './types/profile.js';

export type {
  Contact,
  Education,
  Experience,
  Language,
  LinkedInProfile,
  MissingProfileFieldWarning,
  ParseOptions,
  ParseResult,
  ParseWarning,
  ParsedDateRange,
  ParsedProfileDate,
  ParsedProfileDatePrecision,
  SectionParseWarning,
  WarningSection,
} from './types/profile.js';
export {
  ContactSchema,
  EducationSchema,
  ExperienceSchema,
  LanguageSchema,
  LinkedInProfileSchema,
  ParseResultSchema,
  ParseWarningSchema,
  ParsedDateRangeSchema,
  ParsedProfileDateSchema,
} from './schemas.js';

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
  let text: string;
  let structuralData: { textItems: TextItem[]; layout: LayoutInfo } | null =
    null;

  // Handle both binary PDF data and extracted text inputs
  if (typeof input !== 'string') {
    try {
      // Use structural parser for PDF binary data
      structuralData = await StructuralParser.extractStructuredText(input);

      // Create fallback text from structural data
      const groups = StructuralParser.groupTextByProximity(
        structuralData.textItems
      );
      const lines = StructuralParser.combineGroupedText(groups);
      text = lines.join('\n');
    } catch (error) {
      throw new Error('PDF appears to be empty or unreadable', {
        cause: error,
      });
    }
  } else {
    text = input;
  }

  if (!text || text.length < 50) {
    throw new Error('PDF appears to be empty or unreadable');
  }

  // Clean and parse the text
  const cleanedText = cleanPDFText(text);
  const sectionWarnings: SectionParseWarning[] = [];

  // Parse all sections using specialized parsers
  const basicInfoResult = BasicInfoParser.parseWithWarnings(cleanedText);
  const basicInfo = basicInfoResult.value;
  sectionWarnings.push(...basicInfoResult.warnings);

  const topSkillsResult = ListParser.parseSkillsWithWarnings(cleanedText);
  const topSkills = topSkillsResult.value;
  sectionWarnings.push(...topSkillsResult.warnings);

  const languagesResult = ListParser.parseLanguagesWithWarnings(cleanedText);
  const languages = languagesResult.value;
  sectionWarnings.push(...languagesResult.warnings);

  const structuralLines = structuralData
    ? createStructuralLines({
        layout: structuralData.layout,
        textItems: structuralData.textItems,
      })
    : undefined;
  const structuralIdentityResult = structuralLines
    ? IdentityStructuralParser.parseWithWarnings(structuralLines)
    : undefined;
  const structuralIdentity = structuralIdentityResult?.value;

  if (structuralIdentityResult) {
    sectionWarnings.push(...structuralIdentityResult.warnings);
  }

  const extraSectionsResult = structuralLines
    ? ExtraSectionParser.parseStructuralWithWarnings(structuralLines)
    : ExtraSectionParser.parseTextWithWarnings(cleanedText);
  const extraSections = extraSectionsResult.value;
  sectionWarnings.push(...extraSectionsResult.warnings);

  // Use structural parser for experience if available, otherwise fallback
  let experience: Experience[];
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
  } else {
    // Fallback to old parser for string inputs
    const { ExperienceParser } = await import('./parsers/experience.js');
    const experienceResult = ExperienceParser.parseWithWarnings(cleanedText);
    experience = experienceResult.value;
    sectionWarnings.push(...experienceResult.warnings);
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
    top_skills: structuralIdentity?.topSkills.length
      ? structuralIdentity.topSkills
      : topSkills,
    languages,
    certifications: extraSections.certifications,
    volunteer_work: extraSections.volunteer_work,
    projects: extraSections.projects,
    summary: basicInfo.summary,
    experience,
    education,
  };

  const result: ParseResult = {
    profile,
    warnings: [...createParseWarnings(profile), ...sectionWarnings],
  };

  if (options.includeRawText) {
    result.rawText = text;
  }

  return result;
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
