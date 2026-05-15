import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import {
  extractSection,
  splitLines,
  normalizeWhitespace,
} from '../utils/text-utils.js';
import {
  looksLikeExperienceDetailText,
  looksLikeOrganizationNameText,
} from '../utils/profile-text.js';

export interface Language {
  language: string;
  proficiency: string;
}

export class ListParser {
  static parseSkills(text: string): string[] {
    const skillsSection = extractSection(text, REGEX_PATTERNS.TOP_SKILLS);

    if (!skillsSection) {
      return [];
    }

    const lines = splitLines(skillsSection);
    const skills: string[] = [];

    for (const line of lines) {
      const skill = normalizeWhitespace(line);

      if (this.isLikelySkill(skill)) {
        skills.push(skill);
      }

      if (skills.length === 3) {
        break;
      }
    }

    return skills;
  }

  static parseLanguages(text: string): Language[] {
    const languagesSection = extractSection(text, REGEX_PATTERNS.LANGUAGES);

    if (!languagesSection) {
      return [];
    }

    const lines = splitLines(languagesSection);
    const languages: Language[] = [];

    for (const line of lines) {
      const normalizedLine = normalizeWhitespace(line);

      if (
        !normalizedLine ||
        normalizedLine.toLowerCase().includes('summary') ||
        normalizedLine.toLowerCase().includes('experience') ||
        normalizedLine.toLowerCase().includes('education') ||
        normalizedLine.match(/^page\s+\d+/i)
      ) {
        continue;
      }

      const language = this.extractLanguageInfo(normalizedLine);
      if (language) {
        languages.push(language);
      }
    }

    return languages;
  }

  private static extractLanguageInfo(line: string): Language | null {
    // Handle specific patterns from LinkedIn PDFs
    const specificPatterns = [
      // "Português (Native or Bilingual)" or "Inglês (Professional Working)"
      /^([A-Za-zção]+)\s*\(([^)]+)\)/,
      // "Inglês Professional Working" - without parentheses
      /^([A-Za-zção]+)\s+((?:Professional|Native|Elementary|Bilingual|Working|Limited|Fluent)(?:\s+\w+)?)/i,
    ];

    for (const pattern of specificPatterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          language: match[1].trim(),
          proficiency: match[2].trim(),
        };
      }
    }

    const proficiencyMatch = line.match(REGEX_PATTERNS.LANGUAGE_PROFICIENCY);
    if (proficiencyMatch) {
      const proficiency = proficiencyMatch[1];
      const language = line
        .replace(proficiency, '')
        .replace(/[()]/g, '')
        .trim();

      if (language && language.length > 1 && language.length < 20) {
        return {
          language,
          proficiency,
        };
      }
    }

    if (line.length > 1 && line.length < 20 && /^[A-Za-zção]+$/.test(line)) {
      return {
        language: line,
        proficiency: 'Unknown',
      };
    }

    return null;
  }

  private static isLikelySkill(skill: string): boolean {
    const lowerSkill = skill.toLowerCase();
    const looksLikeCompanyOrInstitution =
      /[\s,]/.test(skill) && looksLikeOrganizationNameText(skill);

    return (
      skill.length > 1 &&
      skill.length < 50 &&
      !looksLikeCompanyOrInstitution &&
      !looksLikeExperienceDetailText(skill) &&
      !lowerSkill.includes('languages') &&
      !lowerSkill.includes('summary') &&
      !lowerSkill.includes('experience') &&
      !lowerSkill.includes('education') &&
      !lowerSkill.includes('page ') &&
      !lowerSkill.match(/^\d+$/)
    );
  }
}
