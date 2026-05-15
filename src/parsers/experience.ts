import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import { normalizeWhitespace } from '../utils/text-utils.js';
import type {
  Experience,
  ParsedSectionResult,
  SectionParseWarning,
} from '../types/profile.js';
import {
  looksLikeDateRangeText,
  parseProfileDateRange,
} from '../utils/date-parser.js';
import { createTextParserLines } from '../utils/parser-lines.js';
import {
  cleanOrganizationNameText,
  isSectionHeaderText,
  looksLikeOrganizationNameText,
  looksLikePositionTitleText,
} from '../utils/profile-text.js';

type TextExperienceState =
  | 'seeking_company'
  | 'seeking_title'
  | 'seeking_dates'
  | 'in_description';

export class ExperienceParser {
  static parse(text: string): Experience[] {
    return this.parseWithWarnings(text).value;
  }

  static parseWithWarnings(text: string): ParsedSectionResult<Experience[]> {
    const parserLines = createTextParserLines(text).filter(
      line => line.section === 'experience'
    );

    const experiences: Experience[] = [];
    const warnings: SectionParseWarning[] = [];
    const lines = parserLines
      .map(line => line.text)
      .filter(line => line.length > 0);

    let currentCompany = '';
    let currentPosition: Partial<Experience> | null = null;
    let descriptionLines: string[] = [];
    let state: TextExperienceState = 'seeking_company';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isSectionHeaderText(line) && !/^experience$/i.test(line)) {
        break;
      }

      const inlineExperience = this.parseInlineTitleAndCompany(line);
      if (inlineExperience) {
        const completedPosition = this.completeExperience({
          position: currentPosition,
          descriptionLines,
        });

        if (completedPosition) {
          experiences.push(completedPosition);
        }

        currentCompany = inlineExperience.company;
        currentPosition = inlineExperience;
        descriptionLines = [];
        state = 'seeking_dates';
        continue;
      }

      if (this.looksLikeCompanyName(line, lines, i)) {
        const completedPosition = this.completeExperience({
          position: currentPosition,
          descriptionLines,
        });

        if (completedPosition) {
          experiences.push(completedPosition);
        }

        currentCompany = cleanOrganizationNameText(line) ?? line;
        currentPosition = null;
        descriptionLines = [];
        state = 'seeking_title';
        continue;
      }

      if (this.isJobTitle(line) && currentCompany) {
        const completedPosition = this.completeExperience({
          position: currentPosition,
          descriptionLines,
        });

        if (completedPosition) {
          experiences.push(completedPosition);
        }

        // Create new position
        currentPosition = {
          title: line,
          company: currentCompany,
          duration: '',
          location: '',
          description: '',
        };
        descriptionLines = [];
        state = 'seeking_dates';
        continue;
      }

      // Handle duration, location, and description
      if (currentPosition) {
        if (this.looksLikeDuration(line)) {
          currentPosition.duration = line;
          currentPosition.dates = parseProfileDateRange(line);
          state = 'in_description';
        } else if (this.looksLikeLocation(line) && !currentPosition.location) {
          currentPosition.location = line;
          state = 'in_description';
        } else if (line.length > 15 && !line.includes('Page')) {
          descriptionLines.push(line);
          state = 'in_description';
        }
      } else if (state !== 'seeking_company' && line.length > 2) {
        warnings.push({
          code: 'section_parse_warning',
          field: 'entry',
          message:
            'Discarded experience line that did not fit the expected state',
          rawText: line,
          section: 'experience',
        });
      }
    }

    // Add final position
    const completedPosition = this.completeExperience({
      position: currentPosition,
      descriptionLines,
    });

    if (completedPosition) {
      experiences.push(completedPosition);
    }

    warnings.push(...this.createExperienceWarnings(experiences, lines));

    return {
      value: experiences,
      warnings,
    };
  }

  private static completeExperience({
    position,
    descriptionLines,
  }: {
    position: Partial<Experience> | null;
    descriptionLines: string[];
  }): Experience | undefined {
    if (!position?.title || !position.company) {
      return undefined;
    }

    return {
      ...(position.dates ? { dates: position.dates } : {}),
      title: position.title,
      company: position.company,
      duration: position.duration ?? '',
      location: position.location,
      description: descriptionLines.join(' ').trim(),
    };
  }

  private static parseInlineTitleAndCompany(
    line: string
  ): Experience | undefined {
    const inlinePatterns = [/^(.+?)\s+(?:at|@)\s+(.+)$/i];

    for (const pattern of inlinePatterns) {
      const match = line.match(pattern);

      if (!match) {
        continue;
      }

      const title = normalizeWhitespace(match[1]);
      const company = cleanOrganizationNameText(match[2]);

      if (this.isJobTitle(title) && company) {
        return {
          title,
          company,
          duration: '',
          location: '',
          description: '',
        };
      }
    }

    return undefined;
  }

  private static looksLikeCompanyName(
    line: string,
    lines: string[],
    index: number
  ): boolean {
    if (
      this.looksLikeDuration(line) ||
      this.looksLikeLocation(line) ||
      this.isJobTitle(line) ||
      isSectionHeaderText(line)
    ) {
      return false;
    }

    const nextLines = lines.slice(index + 1, index + 5);
    const hasJobDetailsAfter = nextLines.some(
      nextLine =>
        this.looksLikeDuration(nextLine) ||
        this.isJobTitle(nextLine) ||
        /^\d+\s+(years?|months?|anos?|meses?)/i.test(nextLine)
    );

    return hasJobDetailsAfter && looksLikeOrganizationNameText(line);
  }

  private static isJobTitle(line: string): boolean {
    return (
      looksLikePositionTitleText(line) &&
      !this.looksLikeDuration(line) &&
      !this.looksLikeLocation(line)
    );
  }

  private static looksLikeDuration(line: string): boolean {
    const normalizedLine = normalizeWhitespace(line);
    REGEX_PATTERNS.DATE_RANGE.lastIndex = 0;

    if (REGEX_PATTERNS.DATE_RANGE.test(normalizedLine)) {
      return true;
    }

    if (normalizedLine.length > 40) {
      return false;
    }

    return (
      /[-–—]|\bto\b|\bpresent\b|\bcurrent\b|\batual\b|\bpresente\b/i.test(
        normalizedLine
      ) && looksLikeDateRangeText(normalizedLine)
    );
  }

  private static looksLikeLocation(line: string): boolean {
    return (
      line.length > 2 &&
      line.length < 50 &&
      (/^[A-Z][a-z]+,\s*[A-Z]{2}$/.test(line) || // "City, ST"
        /^[A-Z][a-z]+,\s*[A-Z][a-z]+$/.test(line) || // "City, State"
        /^[A-Z][a-z]+,\s*[A-Z][a-z]+,\s*[A-Z][a-z]+/.test(line) || // "City, State, Country"
        /(California|New York|Texas|Florida|Illinois|Pennsylvania|Ohio|Georgia|North Carolina|Michigan|CA|NY|TX|FL)/.test(
          line
        )) &&
      !this.looksLikeDuration(line) &&
      !line.includes('@') &&
      !line.includes('|')
    );
  }

  private static createExperienceWarnings(
    experiences: Experience[],
    lines: string[]
  ): SectionParseWarning[] {
    const warnings: SectionParseWarning[] = [];

    if (lines.length > 0 && experiences.length === 0) {
      warnings.push({
        code: 'section_parse_warning',
        field: 'entry',
        message: 'Detected an experience section but could not extract entries',
        rawText: lines.join(' '),
        section: 'experience',
      });
    }

    experiences.forEach((experience, entry) => {
      if (!experience.duration) {
        warnings.push({
          code: 'section_parse_warning',
          entry,
          field: 'dates',
          message: 'Could not extract date range for experience entry',
          rawText: experience.title,
          section: 'experience',
        });
      } else if (!experience.dates) {
        warnings.push({
          code: 'section_parse_warning',
          entry,
          field: 'dates',
          message: 'Could not parse date range',
          rawText: experience.duration,
          section: 'experience',
        });
      }
    });

    return warnings;
  }
}
