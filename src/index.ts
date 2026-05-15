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

interface StructuralLine {
  text: string;
  y: number;
  fontSize: number;
}

interface StructuralOverrides {
  name?: string;
  headline?: string;
  location?: string;
  linkedinUrl?: string;
  topSkills: string[];
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
  const structuralOverrides = structuralData
    ? extractStructuralOverrides(structuralData.textItems)
    : undefined;

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

  const contact: Contact = {
    ...basicInfo.contact,
  };

  if (structuralOverrides?.linkedinUrl) {
    contact.linkedin_url = structuralOverrides.linkedinUrl;
  }

  if (
    contact.phone &&
    contact.linkedin_url?.includes(contact.phone.replace(/\D/g, ''))
  ) {
    delete contact.phone;
  }

  // Combine into final profile
  const profile: LinkedInProfile = {
    name: structuralOverrides?.name ?? basicInfo.name,
    headline: structuralOverrides?.headline ?? basicInfo.headline,
    location: structuralOverrides?.location ?? basicInfo.location,
    contact,
    top_skills: structuralOverrides?.topSkills.length
      ? structuralOverrides.topSkills
      : topSkills,
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

function extractStructuralOverrides(
  textItems: TextItem[]
): StructuralOverrides {
  const leftLines = createColumnLines(textItems, 'left');
  const rightLines = createColumnLines(textItems, 'right').filter(
    line => !/^page\s+\d+\s+of\s+\d+$/i.test(line.text)
  );
  const experienceIndex = rightLines.findIndex(line =>
    /^experience$/i.test(line.text)
  );
  const identityLines = rightLines.slice(
    0,
    experienceIndex === -1 ? rightLines.length : experienceIndex
  );
  const nameIndex = identityLines.findIndex(line => line.fontSize >= 20);
  const name = nameIndex === -1 ? undefined : identityLines[nameIndex].text;
  const headline = identityLines
    .slice(nameIndex === -1 ? 0 : nameIndex + 1)
    .find(line => !isLocationLine(line.text))?.text;
  const location = identityLines.find(line => isLocationLine(line.text))?.text;

  return {
    name,
    headline,
    location,
    linkedinUrl: extractLinkedInUrlFromLines(leftLines.map(line => line.text)),
    topSkills: extractTopSkills(leftLines),
  };
}

function createColumnLines(
  textItems: TextItem[],
  column: 'left' | 'right'
): StructuralLine[] {
  const columnItems = textItems.filter(item =>
    column === 'left' ? item.x < 150 : item.x >= 150
  );
  const groups = StructuralParser.groupTextByProximity(columnItems, 3);
  const lines = StructuralParser.combineGroupedText(groups);

  return lines.map((text, index) => {
    const group = groups[index];

    return {
      text,
      y: group.reduce((sum, item) => sum + item.y, 0) / group.length,
      fontSize:
        group.reduce((sum, item) => sum + item.fontSize, 0) / group.length,
    };
  });
}

function extractTopSkills(lines: StructuralLine[]): string[] {
  const topSkillsIndex = lines.findIndex(line =>
    /^top skills$/i.test(line.text)
  );

  if (topSkillsIndex === -1) {
    return [];
  }

  const followingLines = lines.slice(topSkillsIndex + 1);
  const endIndex = followingLines.findIndex(line =>
    isSidebarSectionHeader(line.text)
  );
  const skillLines =
    endIndex === -1 ? followingLines : followingLines.slice(0, endIndex);

  return skillLines
    .map(line => line.text)
    .filter(skill => skill.length > 1 && skill.length < 50)
    .slice(0, 10);
}

function extractLinkedInUrlFromLines(lines: string[]): string | undefined {
  const linkedInIndex = lines.findIndex(line =>
    /linkedin\.com\/in\//i.test(line)
  );

  if (linkedInIndex === -1) {
    return undefined;
  }

  const linkedInLine = lines[linkedInIndex];
  const nextLine = lines[linkedInIndex + 1] ?? '';
  const combinedLine =
    linkedInLine.trim().endsWith('-') || /\(LinkedIn\)/i.test(nextLine)
      ? `${linkedInLine}${nextLine}`
      : linkedInLine;
  const compactLine = combinedLine
    .replace(/\s+/g, '')
    .replace(/\(LinkedIn\)/i, '');
  const match = compactLine.match(
    /(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9-]+)/
  );

  return match ? `https://linkedin.com/in/${match[1]}` : undefined;
}

function isSidebarSectionHeader(text: string): boolean {
  return /^(languages|certifications|summary|experience|education)$/i.test(
    text
  );
}

function isLocationLine(text: string): boolean {
  return (
    /^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z][A-Za-z]+(?:,\s*[A-Z][A-Za-z\s]+)?$/.test(
      text
    ) || /^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z]{2}$/.test(text)
  );
}

// All types are already exported above
