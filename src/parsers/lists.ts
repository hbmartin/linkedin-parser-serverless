import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import { normalizeWhitespace } from '../utils/text-utils.js';
import type {
  Language,
  ParsedSectionResult,
  SectionParseWarning,
} from '../types/profile.js';
import {
  isSectionHeaderText,
  looksLikeExperienceDetailText,
  looksLikeOrganizationNameText,
} from '../utils/profile-text.js';
import {
  createTextParserLines,
  getParserLineSectionHeader,
  type ParserLineSection,
} from '../utils/parser-lines.js';
import { TOP_SKILLS_LIMIT } from '../utils/parser-limits.js';
import { extractStructuralSectionLines } from '../utils/structural-sections.js';
import type { StructuralLine } from '../utils/structural-lines.js';

interface SkillCandidateContext {
  skill: string;
  followingLines: string[];
}

type ListState = 'seeking_section' | 'collecting';

export class ListParser {
  static parseSkills(text: string): string[] {
    return this.parseSkillsWithWarnings(text).value;
  }

  static parseSkillsWithWarnings(text: string): ParsedSectionResult<string[]> {
    const parserLines = createTextParserLines(text);
    const hasSkillsSection = parserLines.some(line =>
      isHeaderForSection(line.text, 'top_skills')
    );

    if (!hasSkillsSection) {
      return {
        value: [],
        warnings: [],
      };
    }

    let state: ListState = 'seeking_section';
    const skills: string[] = [];
    const warnings: SectionParseWarning[] = [];
    const lines = parserLines.filter(line => line.section === 'top_skills');

    for (let index = 0; index < lines.length; index++) {
      const skill = normalizeWhitespace(lines[index].text);
      const followingLines = lines
        .slice(index + 1, index + 4)
        .map(line => line.text);

      state = 'collecting';

      if (this.isLikelySkill({ skill, followingLines })) {
        skills.push(skill);
      } else if (skill) {
        warnings.push({
          code: 'section_parse_warning',
          field: 'item',
          message: 'Discarded top skills line that did not look like a skill',
          rawText: skill,
          section: 'top_skills',
        });
      }

      if (skills.length === TOP_SKILLS_LIMIT) {
        break;
      }
    }

    if (state === 'collecting' && skills.length === 0) {
      warnings.push({
        code: 'section_parse_warning',
        field: 'section',
        message: 'Detected a top skills section but could not extract skills',
        section: 'top_skills',
      });
    }

    return {
      value: skills,
      warnings,
    };
  }

  static parseLanguages(text: string): Language[] {
    return this.parseLanguagesWithWarnings(text).value;
  }

  static parseLanguagesWithWarnings(
    text: string
  ): ParsedSectionResult<Language[]> {
    const parserLines = createTextParserLines(text);
    const hasLanguagesSection = parserLines.some(line =>
      isHeaderForSection(line.text, 'languages')
    );

    return this.parseLanguageLines({
      hasLanguagesSection,
      lines: parserLines
        .filter(line => line.section === 'languages')
        .map(line => line.text),
    });
  }

  static parseStructuralLanguagesWithWarnings(
    structuralLines: StructuralLine[]
  ): ParsedSectionResult<Language[]> {
    const sectionLines = extractStructuralSectionLines({
      section: 'languages',
      structuralLines,
    });

    return this.parseLanguageLines({
      hasLanguagesSection: sectionLines.hasSection,
      lines: this.mergeWrappedLanguageLines(
        sectionLines.lines.map(line => line.text)
      ),
    });
  }

  private static parseLanguageLines({
    hasLanguagesSection,
    lines,
  }: {
    hasLanguagesSection: boolean;
    lines: string[];
  }): ParsedSectionResult<Language[]> {
    if (!hasLanguagesSection) {
      return {
        value: [],
        warnings: [],
      };
    }

    const languages: Language[] = [];
    const warnings: SectionParseWarning[] = [];

    for (const line of lines) {
      const normalizedLine = normalizeWhitespace(line);

      if (
        !normalizedLine ||
        isLanguageSectionHeaderText(normalizedLine) ||
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
      } else {
        warnings.push({
          code: 'section_parse_warning',
          field: 'item',
          message:
            'Discarded language line that did not match a language shape',
          rawText: normalizedLine,
          section: 'languages',
        });
      }
    }

    if (hasLanguagesSection && languages.length === 0) {
      warnings.push({
        code: 'section_parse_warning',
        field: 'section',
        message: 'Detected a languages section but could not extract languages',
        section: 'languages',
      });
    }

    return {
      value: languages,
      warnings,
    };
  }

  private static extractLanguageInfo(line: string): Language | null {
    // Handle specific patterns from LinkedIn PDFs
    const specificPatterns = [
      // "Chinese (Traditional) (Limited Working)" where the language variant
      // and proficiency are both parenthesized.
      /^([\p{L}\s.+-]+(?:\s*\([\p{L}\s.+-]+\))?)\s*\(([^)]+)\)$/u,
      // "Português (Native or Bilingual)" or "Inglês (Professional Working)"
      /^([\p{L}\s.+-]+?)\s*\(([^)]+)\)/u,
      // "Inglês Professional Working" - without parentheses
      /^([\p{L}\s.+-]+?)\s+((?:Professional|Native|Elementary|Bilingual|Working|Limited|Fluent)(?:\s+\w+)?)/iu,
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

    if (
      line.length > 1 &&
      line.length < 30 &&
      /^[\p{L}][\p{L}\s.+-]*$/u.test(line) &&
      !startsWithLanguageProficiencyWord(line) &&
      !endsWithUnsupportedLanguageProficiencyWord(line) &&
      (!looksLikeOrganizationNameText(line) ||
        looksLikeShortLanguageLabel(line))
    ) {
      return {
        language: line,
        proficiency: 'Unknown',
      };
    }

    return null;
  }

  private static mergeWrappedLanguageLines(lines: string[]): string[] {
    const mergedLines: string[] = [];
    let bufferedLine: string | undefined;

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const normalizedLine = normalizeWhitespace(line);

      if (!normalizedLine) {
        continue;
      }

      if (bufferedLine) {
        bufferedLine = normalizeWhitespace(`${bufferedLine} ${normalizedLine}`);

        if (parenthesisBalance(bufferedLine) <= 0) {
          mergedLines.push(bufferedLine);
          bufferedLine = undefined;
        }

        continue;
      }

      const nextLine = normalizeWhitespace(lines[index + 1] ?? '');
      if (
        looksLikeParenthesizedLanguageContinuation(nextLine) &&
        looksLikeLanguageBaseWithoutProficiency(normalizedLine)
      ) {
        const mergedLine = normalizeWhitespace(`${normalizedLine} ${nextLine}`);

        if (parenthesisBalance(mergedLine) <= 0) {
          mergedLines.push(mergedLine);
        } else {
          bufferedLine = mergedLine;
        }

        index += 1;
        continue;
      }

      if (parenthesisBalance(normalizedLine) > 0) {
        bufferedLine = normalizedLine;
        continue;
      }

      mergedLines.push(normalizedLine);
    }

    if (bufferedLine) {
      mergedLines.push(bufferedLine);
    }

    return mergedLines;
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

function isHeaderForSection(text: string, section: ParserLineSection): boolean {
  const header = getParserLineSectionHeader(text);

  return header?.kind === 'target' && header.section === section;
}

function isLanguageSectionHeaderText(text: string): boolean {
  return /^languages?$/i.test(text) || isHeaderForSection(text, 'languages');
}

function parenthesisBalance(text: string): number {
  return (
    Array.from(text.matchAll(/\(/g)).length -
    Array.from(text.matchAll(/\)/g)).length
  );
}

function looksLikeParenthesizedLanguageContinuation(text: string): boolean {
  return /^\([^)]+(?:\)|$)$/u.test(text);
}

function looksLikeLanguageBaseWithoutProficiency(text: string): boolean {
  return (
    !REGEX_PATTERNS.LANGUAGE_PROFICIENCY.test(text) &&
    /^[\p{L}\s.+-]+(?:\s*\([\p{L}\s.+-]+\))?$/u.test(text)
  );
}

function looksLikeShortLanguageLabel(text: string): boolean {
  const normalizedText = normalizeWhitespace(text);
  const words = normalizedText
    .split(/\s+|-/u)
    .map(word => word.trim())
    .filter(word => word.length > 0);
  const firstWord = words[0]?.toLowerCase();

  if (
    firstWord &&
    /^(?:bilingual|elementary|fluent|limited|native|professional|working)$/u.test(
      firstWord
    )
  ) {
    return false;
  }

  return (
    words.length >= 1 &&
    words.length <= 3 &&
    words.every(word => /^[\p{Lu}][\p{L}\p{M}.+]*$/u.test(word))
  );
}

function startsWithLanguageProficiencyWord(text: string): boolean {
  const firstWord = normalizeWhitespace(text).split(/\s+/u)[0]?.toLowerCase();

  return (
    firstWord !== undefined &&
    /^(?:bilingual|elementary|fluent|limited|native|professional|working)$/u.test(
      firstWord
    )
  );
}

function endsWithUnsupportedLanguageProficiencyWord(text: string): boolean {
  const words = normalizeWhitespace(text).split(/\s+/u);
  const lastWord = words.at(-1)?.toLowerCase();

  return (
    lastWord !== undefined &&
    /^(?:advanced|beginner|intermediate)$/u.test(lastWord)
  );
}
