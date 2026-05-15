import { StructuralParser } from './parsers/structural-parser.js';
import { ExperienceStructuralParser } from './parsers/experience-structural.js';
import { BasicInfoParser } from './parsers/basic-info.js';
import { ListParser } from './parsers/lists.js';
import { EducationParser } from './parsers/education.js';
import { cleanPDFText } from './utils/text-utils.js';
import type { LayoutInfo, TextItem } from './types/structural.js';

export interface Contact {
  email: string;
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
  name: string;
  headline: string;
  location: string;
  contact: Contact;
  top_skills: string[];
  languages: Language[];
  summary?: string;
  experience: Experience[];
  education: Education[];
}

export interface ParseOptions {
  includeRawText?: boolean;
}

export interface ParseResult {
  profile: LinkedInProfile;
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

  const education = EducationParser.parse(cleanedText);

  // Combine into final profile
  const profile: LinkedInProfile = {
    name: basicInfo.name,
    headline: basicInfo.headline,
    location: basicInfo.location,
    contact: basicInfo.contact,
    top_skills: topSkills,
    languages,
    summary: basicInfo.summary,
    experience,
    education,
  };

  // Basic validation
  if (!profile.name || !profile.contact.email) {
    throw new Error(
      'Could not extract basic profile information (name or email missing)'
    );
  }

  const result: ParseResult = { profile };

  if (options.includeRawText) {
    result.rawText = text;
  }

  return result;
}

// All types are already exported above
