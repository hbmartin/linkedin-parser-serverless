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

export interface Experience {
  title: string;
  company: string;
  duration: string;
  location?: string;
  description?: string;
}

export interface Education {
  degree: string;
  institution: string;
  year?: string;
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

export type ParseWarning = MissingProfileFieldWarning;

export interface ParseResult {
  profile: LinkedInProfile;
  warnings: ParseWarning[];
  rawText?: string;
}

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

  // Parse all sections using specialized parsers
  const basicInfo = BasicInfoParser.parse(cleanedText);
  const topSkills = ListParser.parseSkills(cleanedText);
  const languages = ListParser.parseLanguages(cleanedText);
  const structuralLines = structuralData
    ? createStructuralLines({
        layout: structuralData.layout,
        textItems: structuralData.textItems,
      })
    : undefined;
  const structuralIdentity = structuralLines
    ? IdentityStructuralParser.parse(structuralLines)
    : undefined;
  const extraSections = structuralLines
    ? ExtraSectionParser.parseStructural(structuralLines)
    : ExtraSectionParser.parseText(cleanedText);

  // Use structural parser for experience if available, otherwise fallback
  let experience: Experience[];
  if (structuralData) {
    const workExperiences = ExperienceStructuralParser.parseExperience(
      structuralData.textItems
    );

    // Convert WorkExperience[] to Experience[] for compatibility
    experience = workExperiences.flatMap(workExp =>
      workExp.positions.map(position => ({
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
    experience = ExperienceParser.parse(cleanedText);
  }

  const structuralEducation = structuralLines
    ? EducationParser.parseStructural(structuralLines)
    : [];
  const education = structuralEducation.length
    ? structuralEducation
    : EducationParser.parse(cleanedText);

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
    warnings: createParseWarnings(profile),
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
