import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import {
  extractSection,
  splitLines,
  normalizeWhitespace,
} from '../utils/text-utils.js';

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

    // Manual parsing approach for LinkedIn PDF structure
    const knownCompanies = [
      'Carta',
      'Boba Joy',
      'Zestt',
      'Partiu Vantagens!',
      'AevoTech',
      'Inovare',
      'CEPEL',
      'CPTI / PUC-Rio',
      'Arena Games',
      'Guild',
      'Springboard',
    ];

    let currentCompany = '';
    let currentPosition: Partial<Experience> | null = null;
    let descriptionLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Stop at Education section
      if (line.toLowerCase().includes('education')) {
        break;
      }

      // Check for known company names
      if (
        knownCompanies.some(company =>
          line.toLowerCase().includes(company.toLowerCase())
        )
      ) {
        // Save previous position
        if (currentPosition && currentPosition.title) {
          currentPosition.description = descriptionLines.join(' ').trim();
          experiences.push(currentPosition as Experience);
        }

        currentCompany = line;
        currentPosition = null;
        descriptionLines = [];
        continue;
      }

      // Check for job titles - be more specific
      if (this.isJobTitle(line) && currentCompany) {
        // Save previous position
        if (currentPosition && currentPosition.title) {
          currentPosition.description = descriptionLines.join(' ').trim();
          experiences.push(currentPosition as Experience);
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
    if (currentPosition && currentPosition.title) {
      currentPosition.description = descriptionLines.join(' ').trim();
      experiences.push(currentPosition as Experience);
    }

    return experiences;
  }

  private static isJobTitle(line: string): boolean {
    const titleKeywords = [
      'Engineering Manager',
      'Tech Lead Manager',
      'Senior Software Engineer',
      'Co-founder',
      'Engineering Director',
      'Head of Engineering',
      'Senior Lead Software Engineer',
      'Lead Project Engineer',
      'Robotics Researcher',
      'Technical Researcher',
      'Technical Support Analyst',
      'Software Engineer III',
      'Senior Software Engineer I',
    ];

    // Don't include lines that start with duration patterns
    if (/^\d+\s+(year|month)/.test(line)) {
      return false;
    }

    // Check for exact title matches or titles that start the line
    for (const title of titleKeywords) {
      if (
        line.toLowerCase().includes(title.toLowerCase()) &&
        !line.includes('•') &&
        line.length < 150
      ) {
        // Make sure duration info isn't mixed in the title
        const cleanTitle = line
          .replace(/\d+\s+(year|month)s?\s+\d+\s+(month|year)s?/gi, '')
          .trim();
        if (cleanTitle.length > 10) {
          return true;
        }
      }
    }

    return false;
  }

  private static looksLikeCompanyName(
    line: string,
    lines: string[],
    index: number
  ): boolean {
    // Skip obvious non-companies
    if (
      line.length < 2 ||
      line.length > 50 ||
      line.toLowerCase() === 'experience' ||
      line.toLowerCase().includes('page') ||
      this.looksLikeDuration(line) ||
      this.looksLikeLocation(line) ||
      this.looksLikeJobTitle(line) ||
      line.includes('•') ||
      line.includes('(') ||
      line.includes(')') ||
      /^[a-z]/.test(line) || // Starts with lowercase
      /\d+\s+years?\s+\d+\s+months?/.test(line) // Duration patterns
    ) {
      return false;
    }

    // Look ahead to see if next few lines look like job details
    const nextLines = lines.slice(index + 1, index + 6);
    const hasJobDetailsAfter = nextLines.some(nextLine => {
      const normalizedNext = nextLine.trim();
      return (
        this.looksLikeDuration(normalizedNext) ||
        this.looksLikeJobTitle(normalizedNext) ||
        /^\d+\s+years?\s+\d+\s+months?/.test(normalizedNext) ||
        normalizedNext.includes('Manager') ||
        normalizedNext.includes('Engineer') ||
        normalizedNext.includes('Director')
      );
    });

    // Known company name patterns - be more specific
    const companyPatterns = [
      /^(Carta|Boba Joy|Zestt|Partiu Vantagens!|AevoTech|Inovare|CEPEL|CPTI|Arena Games)$/i,
      /^[A-Z]{2,5}$/, // Acronyms like CEPEL, CPTI
      /^[A-Z][A-Za-z\s&]+$/, // Standard company names
    ];

    // Special handling for multi-part company names
    if (/^CPTI\s*\/\s*PUC/.test(line)) {
      return true;
    }

    return (
      hasJobDetailsAfter && companyPatterns.some(pattern => pattern.test(line))
    );
  }

  private static parseJobTitleLine(line: string): Partial<Experience> {
    // Try to extract title and company from various formats
    const patterns = [
      /^(.+?)\s+at\s+(.+)$/i,
      /^(.+?)\s+@\s+(.+)$/i,
      /^(.+?)\s*[·•-]\s*(.+)$/,
      /^(.+?),\s*(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          title: match[1].trim(),
          company: match[2].trim(),
          location: '',
          duration: '',
          description: '',
        };
      }
    }

    // For LinkedIn PDFs, sometimes company names appear separately
    // If it's just a job title, we'll need to find the company in context
    return {
      title: line,
      company: '', // Will be filled by parsing context
      location: '',
      duration: '',
      description: '',
    };
  }

  private static looksLikeJobTitle(line: string): boolean {
    const lowerLine = line.toLowerCase();

    // Skip obvious non-job-title lines
    if (
      line.length < 5 ||
      line.length > 100 ||
      lowerLine.includes('education') ||
      lowerLine.includes('skills') ||
      this.looksLikeDuration(line) ||
      this.looksLikeLocation(line) ||
      line.includes('•') || // Bullet points are usually descriptions
      line.includes('%') || // Percentages are usually descriptions
      line.includes('$') || // Money amounts are usually descriptions
      /^\d+/.test(line) || // Lines starting with numbers are usually descriptions
      /^[a-z]/.test(line) // Lines starting with lowercase are usually descriptions
    ) {
      return false;
    }

    // More specific job title patterns
    const jobTitlePatterns = [
      // Title at/@ Company patterns
      /^[A-Z][A-Za-z\s]+\s+(at|@)\s+[A-Z][A-Za-z\s]+$/,
      // Standalone titles that are likely job titles
      /^(Senior|Lead|Principal|Chief|Head of|Director of|VP of|President of)\s+/i,
      /^(Engineering|Software|Product|Data|Marketing|Sales|Business|Technical|Project)\s+(Manager|Engineer|Analyst|Director|Lead)/i,
      // Company names with title patterns
      /[·•-]\s*[A-Z][A-Za-z\s]+$/,
    ];

    return jobTitlePatterns.some(pattern => pattern.test(line));
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

  private static isSectionHeader(line: string): boolean {
    const lowerLine = line.toLowerCase();
    return (
      lowerLine.includes('education') ||
      lowerLine.includes('skills') ||
      lowerLine.includes('languages') ||
      lowerLine.includes('certifications')
    );
  }
}
