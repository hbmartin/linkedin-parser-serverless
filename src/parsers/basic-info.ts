import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import {
  extractFirstMatch,
  extractSection,
  splitLines,
  normalizeWhitespace,
} from '../utils/text-utils.js';
import {
  isLikelyLocationText,
  isSectionHeaderText,
  looksLikeOrganizationNameText,
  looksLikePersonNameText,
  looksLikePositionTitleText,
} from '../utils/profile-text.js';

export interface Contact {
  email?: string;
  phone?: string;
  linkedin_url?: string;
  location?: string;
}

export interface BasicInfo {
  name?: string;
  headline?: string;
  location?: string;
  summary?: string;
  contact: Contact;
}

const LOWERCASE_NAME_CONNECTORS = new Set([
  'al',
  'bin',
  'binti',
  'da',
  'das',
  'de',
  'del',
  'della',
  'den',
  'der',
  'di',
  'do',
  'dos',
  'du',
  'e',
  'el',
  'la',
  'le',
  'van',
  'von',
  'y',
]);

export class BasicInfoParser {
  static parse(text: string): BasicInfo {
    return {
      name: this.extractName(text),
      headline: this.extractHeadline(text),
      location: this.extractLocation(text),
      summary: this.extractSummary(text),
      contact: this.extractContact(text),
    };
  }

  private static extractName(text: string): string | undefined {
    const lines = splitLines(text);

    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const name = this.extractNameFromLine(lines[i]);

      if (name) {
        return name;
      }
    }

    return undefined;
  }

  private static extractNameFromLine(line: string): string | undefined {
    const normalizedLine = normalizeWhitespace(line);

    if (!this.isNameSearchLine(normalizedLine)) {
      return undefined;
    }

    const words = normalizedLine.split(/\s+/).filter(Boolean);
    const maxCandidateLength = Math.min(6, words.length);

    for (let length = maxCandidateLength; length >= 2; length--) {
      const candidateWords = words.slice(0, length);
      const hasConnector = candidateWords.some(word =>
        LOWERCASE_NAME_CONNECTORS.has(word.toLowerCase())
      );

      if (
        (length > 3 && !hasConnector) ||
        (words.length > length && length > 2 && !hasConnector)
      ) {
        continue;
      }

      const candidate = candidateWords.join(' ');

      if (looksLikePersonNameText(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  private static extractLocation(text: string): string | undefined {
    const lines = splitLines(text);
    const firstSectionIndex = lines.findIndex(line =>
      isSectionHeaderText(line)
    );
    const searchableLines = lines.slice(
      0,
      firstSectionIndex === -1 ? Math.min(30, lines.length) : firstSectionIndex
    );

    return searchableLines
      .map(line => normalizeWhitespace(line))
      .find(line => this.isLocationSearchLine(line));
  }

  private static extractHeadline(text: string): string | undefined {
    const lines = splitLines(text);

    for (let i = 0; i < Math.min(25, lines.length); i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      const isLikelyEmail =
        /^[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i.test(line);
      const isShortCompanyHeadline =
        !isLikelyEmail &&
        /^[A-Za-z][A-Za-z\s./+-]{1,40}\s+@\s+[A-Za-z0-9][A-Za-z0-9\s.&-]{1,40}$/.test(
          line
        );

      if (
        line.includes('http') ||
        line.includes('www.') ||
        (line.includes('@') && !isShortCompanyHeadline) ||
        lowerLine.includes('contact') ||
        lowerLine.includes('page') ||
        lowerLine.includes('skills') ||
        lowerLine.includes('languages') ||
        (!isShortCompanyHeadline && line.length < 15)
      ) {
        continue;
      }

      if (isShortCompanyHeadline) {
        return normalizeWhitespace(line);
      }

      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          return normalizeWhitespace(line);
        }
      }

      const titlePatterns = [
        /^(Senior|Lead|Principal|Chief|Director|VP|President|Software|Full[Ss]tack|Python|TypeScript).*(Engineer|Manager|Developer|Specialist)/i,
        /(Engineering|Software|Product|Data|Marketing|Sales|Business).+(Manager|Engineer|Analyst|Director)/i,
      ];

      for (const pattern of titlePatterns) {
        if (pattern.test(line) && line.length > 30) {
          return normalizeWhitespace(line);
        }
      }
    }

    const specificPattern =
      /Engineering\s+Manager\s+@\s+[A-Za-z]+\s*\|\s*[^|\n]*(?:\n[^|\n]*)?/i;
    const specificMatch = text.match(specificPattern);
    if (specificMatch) {
      return normalizeWhitespace(specificMatch[0].trim());
    }

    return undefined;
  }

  private static extractSummary(text: string): string | undefined {
    const summarySection = extractSection(text, REGEX_PATTERNS.SUMMARY);

    if (summarySection) {
      const summary = normalizeWhitespace(summarySection)
        .split('\n')
        .filter(line => line.trim().length > 10)
        .join(' ')
        .slice(0, 500);

      return summary || undefined;
    }

    const lines = splitLines(text);
    const potentialSummaryLines: string[] = [];

    for (let i = 5; i < Math.min(30, lines.length); i++) {
      const line = lines[i];

      if (
        line.length > 50 &&
        line.length < 200 &&
        !line.includes('@') &&
        !line.toLowerCase().includes('experience') &&
        !line.toLowerCase().includes('education') &&
        !line.toLowerCase().includes('skills')
      ) {
        potentialSummaryLines.push(line);

        if (potentialSummaryLines.join(' ').length > 100) {
          break;
        }
      }
    }

    const summary = potentialSummaryLines.join(' ').slice(0, 500);

    return summary || undefined;
  }

  private static extractContact(text: string): Contact {
    const contact: Contact = {};
    const email = this.extractEmail(text);

    if (email) {
      contact.email = email;
    }

    const linkedInUrl = this.extractLinkedInUrl(text);

    if (linkedInUrl) {
      contact.linkedin_url = linkedInUrl;
    }

    const phoneMatch = extractFirstMatch(text, REGEX_PATTERNS.PHONE);
    if (phoneMatch && phoneMatch.replace(/\D/g, '').length >= 10) {
      contact.phone = phoneMatch;
    }

    return contact;
  }

  private static extractLinkedInUrl(text: string): string | undefined {
    const lines = splitLines(text);

    for (let i = 0; i < lines.length; i++) {
      const linkedinMatch = lines[i].match(
        /(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9-]+)/i
      );

      if (!linkedinMatch) {
        continue;
      }

      const usernameParts = [linkedinMatch[1]];

      if (linkedinMatch[1].endsWith('-')) {
        for (const nextLine of lines.slice(i + 1, i + 4)) {
          const continuation = nextLine
            .replace(/\s*\(LinkedIn\)\s*$/i, '')
            .trim();

          if (/^[a-zA-Z0-9-]+$/.test(continuation)) {
            usernameParts.push(continuation);
            break;
          }
        }
      }

      return `https://linkedin.com/in/${usernameParts.join('')}`;
    }

    const fallbackMatch = text.match(REGEX_PATTERNS.LINKEDIN);
    return fallbackMatch
      ? `https://linkedin.com/in/${fallbackMatch[1]}`
      : undefined;
  }

  private static extractEmail(text: string): string | undefined {
    const normalizedText = text.replace(/\s*@\s*/g, '@');
    const match = normalizedText.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}/i
    );

    return match?.[0];
  }

  private static isNameSearchLine(line: string): boolean {
    return (
      line.length >= 5 &&
      line.length <= 120 &&
      !/[0-9]/.test(line) &&
      !/[|()]/.test(line) &&
      !/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,63}/i.test(line) &&
      !/https?:\/\//i.test(line) &&
      !/(?:^|\s)www\./i.test(line) &&
      !/^page\s+\d+/i.test(line) &&
      !isSectionHeaderText(line) &&
      !isLikelyLocationText(line) &&
      !looksLikePositionTitleText(line) &&
      !looksLikeOrganizationNameText(line)
    );
  }

  private static isLocationSearchLine(line: string): boolean {
    return (
      line.length >= 3 &&
      line.length <= 120 &&
      !/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,63}/i.test(line) &&
      !/https?:\/\//i.test(line) &&
      !/(?:^|\s)www\./i.test(line) &&
      !/^page\s+\d+/i.test(line) &&
      !isSectionHeaderText(line) &&
      isLikelyLocationText(line)
    );
  }
}
