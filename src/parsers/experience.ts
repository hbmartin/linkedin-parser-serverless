import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import {
  extractSection,
  splitLines,
  normalizeWhitespace,
} from '../utils/text-utils.js';
import {
  cleanOrganizationNameText,
  isSectionHeaderText,
  looksLikeOrganizationNameText,
  looksLikePositionTitleText,
} from '../utils/profile-text.js';

export interface Experience {
  title: string;
  company: string;
  duration: string;
  location?: string;
  description?: string;
}

export class ExperienceParser {
  static parse(text: string): Experience[] {
    const experienceSection = extractSection(text, REGEX_PATTERNS.EXPERIENCE);

    if (!experienceSection) {
      return [];
    }

    const experiences: Experience[] = [];
    const lines = splitLines(experienceSection)
      .map(line => normalizeWhitespace(line))
      .filter(line => line.length > 0);

    let currentCompany = '';
    let currentPosition: Partial<Experience> | null = null;
    let descriptionLines: string[] = [];

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
        continue;
      }

      // Handle duration, location, and description
      if (currentPosition) {
        if (this.looksLikeDuration(line)) {
          currentPosition.duration = line;
        } else if (this.looksLikeLocation(line) && !currentPosition.location) {
          currentPosition.location = line;
        } else if (line.length > 15 && !line.includes('Page')) {
          descriptionLines.push(line);
        }
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

    return experiences;
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
    return (
      REGEX_PATTERNS.DATE_RANGE.test(line) ||
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
        line
      ) ||
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line) ||
      /\b\d{4}\s*-\s*\d{4}\b/.test(line) ||
      /\b\d{4}\s*-\s*(present|current)\b/i.test(line) ||
      /\(\d+\s+years?\s+\d+\s+months?\)/i.test(line) ||
      (/present|atual|current/i.test(line) && line.length < 50)
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
}
