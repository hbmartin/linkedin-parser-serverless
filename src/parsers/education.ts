import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import {
  extractSection,
  splitLines,
  normalizeWhitespace,
} from '../utils/text-utils.js';

export interface Education {
  degree: string;
  institution: string;
  year?: string;
  location?: string;
  description?: string;
}

export class EducationParser {
  static parse(text: string): Education[] {
    const educationSection = extractSection(text, REGEX_PATTERNS.EDUCATION);

    if (!educationSection) {
      return [];
    }

    const educations: Education[] = [];
    const lines = splitLines(educationSection);

    let currentEducation: Partial<Education> | null = null;

    for (const line of lines) {
      const normalizedLine = normalizeWhitespace(line);

      // Skip empty lines
      if (!normalizedLine || normalizedLine.length < 3) {
        continue;
      }

      // Check if this looks like an institution name
      if (this.looksLikeInstitution(normalizedLine)) {
        // Save previous education if exists
        if (currentEducation && currentEducation.institution) {
          educations.push(this.fillDefaults(currentEducation));
        }

        // Start new education
        currentEducation = {
          institution: normalizedLine,
          degree: '',
          year: '',
          location: '',
        };
      }
      // Check if this looks like a degree (could contain year info)
      else if (currentEducation && this.looksLikeDegree(normalizedLine)) {
        // Check if the degree line also contains year info
        const yearInDegree = this.extractYearFromLine(normalizedLine);
        if (yearInDegree) {
          currentEducation.degree = this.removeYearFromDegree(normalizedLine);
          currentEducation.year = yearInDegree;
        } else {
          currentEducation.degree = normalizedLine;
        }
      }
      // Check if this looks like a year
      else if (currentEducation && this.looksLikeYear(normalizedLine)) {
        currentEducation.year = normalizedLine;
      }
      // Check if this looks like a location
      else if (currentEducation && this.looksLikeLocation(normalizedLine)) {
        currentEducation.location = normalizedLine;
      }
      // If we don't have an institution yet, maybe this line is it
      else if (!currentEducation) {
        currentEducation = {
          institution: normalizedLine,
          degree: '',
          year: '',
          location: '',
        };
      }
    }

    // Add the last education
    if (currentEducation && currentEducation.institution) {
      educations.push(this.fillDefaults(currentEducation));
    }

    return educations;
  }

  private static looksLikeInstitution(line: string): boolean {
    const lower = line.toLowerCase();

    return (
      line.length > 5 &&
      line.length < 100 &&
      (/university|college|school|institute/.test(lower) ||
        /^[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*$/.test(line)) &&
      !this.looksLikeDegree(line) &&
      !this.looksLikeYear(line)
    );
  }

  private static looksLikeDegree(line: string): boolean {
    const lower = line.toLowerCase();

    return (
      line.length > 3 &&
      line.length < 80 &&
      /bachelor|master|phd|mba|engineering|science|business/.test(lower) &&
      !/^\s*[()·-]?\s*(19|20)\d{2}/.test(line)
    );
  }

  private static looksLikeYear(line: string): boolean {
    return (
      /^\d{4}$/.test(line) ||
      /\b(19|20)\d{2}\b/.test(line) ||
      /\d{4}\s*-\s*\d{4}/.test(line) ||
      /\d{4}\s*-\s*present/i.test(line) ||
      /\(\d{4}\s*-\s*\d{4}\)/.test(line)
    );
  }

  private static extractYearFromLine(line: string): string {
    // Extract year patterns from lines that might contain both degree and year info
    const yearPatterns = [
      /\(\d{4}\s*-\s*\d{4}\)/, // (2017 - 2018)
      /·\s*\(\d{4}\s*-\s*\d{4}\)/, // · (2002 - 2005)
      /\b\d{4}\s*-\s*\d{4}\b/, // 2017 - 2018
      /\(\d{4}\)/, // (2016)
      /\b\d{4}\b/, // 2016
    ];

    for (const pattern of yearPatterns) {
      const match = line.match(pattern);
      if (match) {
        return match[0].replace(/[()·]/g, '').trim();
      }
    }

    return '';
  }

  private static removeYearFromDegree(line: string): string {
    return normalizeWhitespace(
      line
        .replace(/\s*[·-]?\s*\((?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}\)\s*/g, ' ')
        .replace(/\s*[·-]?\s*(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}\s*/g, ' ')
        .replace(/\s*[·-]?\s*\((?:19|20)\d{2}\)\s*/g, ' ')
        .replace(/\s*[·-]?\s*\b(?:19|20)\d{2}\b\s*/g, ' ')
        .replace(/[·()]+$/g, '')
    );
  }

  private static looksLikeLocation(line: string): boolean {
    return (
      line.length > 2 &&
      line.length < 50 &&
      /^[A-Z][a-z]+(?:,\s*[A-Z][a-z]*)*$/i.test(line) &&
      !this.looksLikeYear(line) &&
      !this.looksLikeDegree(line)
    );
  }

  private static fillDefaults(education: Partial<Education>): Education {
    return {
      institution: education.institution || '',
      degree: education.degree || '',
      year: education.year || '',
      location: education.location || '',
    };
  }
}
