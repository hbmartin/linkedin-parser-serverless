import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import {
  extractSection,
  splitLines,
  normalizeWhitespace,
} from '../utils/text-utils.js';
import {
  isSectionHeaderText,
  looksLikeExperienceDetailText,
  looksLikeOrganizationNameText,
} from '../utils/profile-text.js';
import { TOP_SKILLS_LIMIT } from '../utils/parser-limits.js';

interface SkillCandidateContext {
  skill: string;
  followingLines: string[];
}

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

    const lines = splitLines(skillsSection).map(line =>
      normalizeWhitespace(line)
    );
    const skills: string[] = [];

    for (let index = 0; index < lines.length; index++) {
      const skill = lines[index];
      const followingLines = lines.slice(index + 1, index + 4);

      if (this.isLikelySkill({ skill, followingLines })) {
        skills.push(skill);
      }

      if (skills.length === TOP_SKILLS_LIMIT) {
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

  private static isLikelySkill({
    skill,
    followingLines,
  }: SkillCandidateContext): boolean {
    const nextLine = followingLines[0] ?? '';
    const nextLineSuggestsExperience =
      looksLikeExperienceDetailText(nextLine) ||
      /^\d+\s+(years?|months?|anos?|meses?)/i.test(nextLine);
    const looksLikeCompanyOrInstitution =
      /[\s,]/.test(skill) &&
      looksLikeOrganizationNameText(skill) &&
      nextLineSuggestsExperience;

    return (
      skill.length > 1 &&
      skill.length < 50 &&
      !looksLikeCompanyOrInstitution &&
      !looksLikeExperienceDetailText(skill) &&
      !isSectionHeaderText(skill) &&
      !/^page\s+\d+/i.test(skill) &&
      !/^\d+$/.test(skill)
    );
  }
}
