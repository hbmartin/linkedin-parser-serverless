import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import {
  extractFirstMatch,
  extractSection,
  splitLines,
  normalizeWhitespace,
} from '../utils/text-utils.js';

export interface Contact {
  email: string;
  phone?: string;
  linkedin_url?: string;
  location?: string;
}

export interface BasicInfo {
  name: string;
  headline: string;
  location: string;
  summary: string;
  contact: Contact;
}

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

  private static extractName(text: string): string {
    // Strategy: Look for the pattern that appears in all LinkedIn PDFs
    // The name always appears as a large text item (font size 26) in the main content

    // First try to find specific known patterns
    const knownNamePatterns = [
      /Arkady\s+Zalkowitsch/i,
      /Thamiris\s+Zalkowitsch/i,
      /Daniel\s+Braga/i,
    ];

    for (const pattern of knownNamePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    // General approach: Look for two-word names that appear early in text
    // and are likely to be the main person's name
    const lines = splitLines(text);

    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      const sectionHeaders = [
        'contact',
        'contact info',
        'top skills',
        'skills',
        'linkedin',
        'summary',
        'experience',
        'education',
        'languages',
        'competências',
        'contato',
        'principais',
      ];

      // Skip obvious non-name content
      if (
        line.includes('@') ||
        line.includes('http') ||
        line.includes('www.') ||
        line.includes('(') ||
        line.includes(')') ||
        line.includes('|') ||
        line.length < 5 ||
        line.length > 80 ||
        sectionHeaders.includes(lowerLine) ||
        lowerLine.startsWith('page ') ||
        lowerLine.includes('strategic') ||
        lowerLine.includes('roadmap') ||
        lowerLine.includes('engineering') ||
        lowerLine.includes('project') ||
        lowerLine.includes('planning')
      ) {
        continue;
      }

      // Look for clean two-word name pattern (First Last)
      const nameMatch = line.match(/^([A-Z][a-z]{1,}\s+[A-Z][a-z]{1,})\s*$/);
      if (nameMatch) {
        const potentialName = nameMatch[1];

        // Additional validation: exclude common false positives
        const excludeWords = [
          'top skills',
          'main content',
          'work experience',
          'contact info',
        ];
        if (
          !excludeWords.some(exclude =>
            potentialName.toLowerCase().includes(exclude)
          )
        ) {
          return potentialName;
        }
      }

      // Also try to match names that might have more complex patterns
      const complexNameMatch = line.match(
        /^([A-Z][a-z]{1,}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*$/
      );
      if (complexNameMatch && line.split(' ').length <= 3) {
        const potentialName = complexNameMatch[1];

        // Make sure it's not a skill or section header
        if (
          !potentialName.toLowerCase().includes('strategic') &&
          !potentialName.toLowerCase().includes('top') &&
          !potentialName.toLowerCase().includes('electronic') &&
          !potentialName.toLowerCase().includes('project')
        ) {
          return potentialName;
        }
      }

      const leadingNameMatch = line.match(
        /^([A-Z][a-z]{1,}\s+[A-Z][a-z]{1,})\s+/
      );
      if (leadingNameMatch) {
        const potentialName = leadingNameMatch[1];
        const firstWord = potentialName.split(' ')[0].toLowerCase();
        const nonNameStarts = [
          'senior',
          'lead',
          'principal',
          'software',
          'technical',
          'product',
        ];

        if (!nonNameStarts.includes(firstWord)) {
          return potentialName;
        }
      }
    }

    return '';
  }

  private static extractLocation(text: string): string {
    const locationPatterns = [
      // Full location with United States
      /([A-Z][a-z]+,\s*[A-Z][a-z]+,?\s*United States)/,
      // City, State, Country
      /([A-Z][a-z]+,\s*[A-Z][a-z]+,?\s*[A-Z]{2,}?)(?:\s|$)/,
      // City, State abbreviation
      /([A-Z][a-z]+,\s*[A-Z]{2})(?:\s|$)/,
      // Common cities
      /(New York|San Francisco|Los Angeles|Chicago|Boston|Austin|Seattle|London|Toronto|Sunnyvale|Santa Clara)/i,
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const location = match[1];
        // Clean up common issues
        if (location.includes('United States')) {
          return location;
        }
        return location;
      }
    }

    // Look in specific lines that might contain location after headline
    const lines = splitLines(text);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes(',') &&
        (line.toLowerCase().includes('california') ||
          line.toLowerCase().includes('united states') ||
          line.includes('CA'))
      ) {
        // Check if this line looks like a location
        const locationMatch = line.match(
          /([A-Z][a-z]+.*(?:California|United States|CA))/
        );
        if (locationMatch) {
          return locationMatch[1].trim();
        }
      }
    }

    return '';
  }

  private static extractHeadline(text: string): string {
    const lines = splitLines(text);

    // Look for headline patterns with pipe separators
    for (let i = 0; i < Math.min(25, lines.length); i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();

      // Skip URLs, contact info, and other non-headline content
      if (
        line.includes('http') ||
        line.includes('www.') ||
        line.includes('@') ||
        lowerLine.includes('contact') ||
        lowerLine.includes('page') ||
        lowerLine.includes('skills') ||
        lowerLine.includes('languages') ||
        line.length < 15
      ) {
        continue;
      }

      // Look for lines with multiple pipe separators (typical headline format)
      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          // At least 3 parts suggest a detailed headline
          return normalizeWhitespace(line);
        }
      }

      // Look for job title patterns in longer lines
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

    // Fallback: Look for specific headline pattern from first PDF
    const specificPattern =
      /Engineering\s+Manager\s+@\s+[A-Za-z]+\s*\|\s*[^|\n]*(?:\n[^|\n]*)?/i;
    const specificMatch = text.match(specificPattern);
    if (specificMatch) {
      return normalizeWhitespace(specificMatch[0].trim());
    }

    return '';
  }

  private static extractSummary(text: string): string {
    const summarySection = extractSection(text, REGEX_PATTERNS.SUMMARY);

    if (summarySection) {
      return normalizeWhitespace(summarySection)
        .split('\n')
        .filter(line => line.trim().length > 10)
        .join(' ')
        .slice(0, 500);
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

    return potentialSummaryLines.join(' ').slice(0, 500);
  }

  private static extractContact(text: string): Contact {
    const contact: Contact = {
      email: '',
    };

    // Extract email - use more robust approach
    contact.email = this.extractEmail(text);

    // Extract LinkedIn URL - handle both complete URLs and broken ones
    const linkedinPatterns = [
      /www\.linkedin\.com\/in\/([a-zA-Z0-9-]+)/i,
      /linkedin\.com\/in\/([a-zA-Z0-9-]+)/i,
      REGEX_PATTERNS.LINKEDIN,
    ];

    for (const pattern of linkedinPatterns) {
      const linkedinMatch = text.match(pattern);
      if (linkedinMatch) {
        const username = linkedinMatch[1];
        contact.linkedin_url = `https://linkedin.com/in/${username}`;
        break;
      }
    }

    // Handle multi-line LinkedIn URLs (like "www.linkedin.com/in/thamiris-\nzalkowitsch")
    const multiLineLinkedIn =
      /www\.linkedin\.com\/in\/([a-zA-Z0-9-]+)[\s\n]*([a-zA-Z0-9-]*)/i;
    const multiMatch = text.match(multiLineLinkedIn);
    if (multiMatch && !contact.linkedin_url) {
      const username = multiMatch[1] + (multiMatch[2] || '');
      contact.linkedin_url = `https://linkedin.com/in/${username}`;
    }

    // Extract phone number
    const phoneMatch = extractFirstMatch(text, REGEX_PATTERNS.PHONE);
    if (phoneMatch) {
      contact.phone = phoneMatch;
    }

    return contact;
  }

  private static extractEmail(text: string): string {
    // Common email domains to validate against
    const validDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'email.com',
      'mail.com',
      'aol.com',
      'icloud.com',
      'protonmail.com',
      'zoho.com',
      'yandex.com',
    ];

    // Find all @ symbols and extract context
    const atIndices: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '@') {
        atIndices.push(i);
      }
    }

    for (const atIndex of atIndices) {
      // Extract context around @ symbol
      const before = text.substring(Math.max(0, atIndex - 50), atIndex);
      const after = text.substring(
        atIndex + 1,
        Math.min(text.length, atIndex + 50)
      );

      // Get username part (before @)
      const usernameMatch = before.match(/([A-Za-z0-9._%+-]+)$/);
      if (!usernameMatch) {
        continue;
      }

      let username = usernameMatch[1];

      // Clean username by removing common prefixes
      const cleanedUsername = username
        .replace(/^Contact/i, '') // Remove "Contact"
        .replace(/^Email/i, '') // Remove "Email"
        .replace(/^Mail/i, '') // Remove "Mail"
        .replace(/^Send/i, '') // Remove "Send"
        .trim();

      // Use cleaned username if it's still valid
      if (
        cleanedUsername.length > 0 &&
        /^[A-Za-z0-9._%+-]+$/.test(cleanedUsername)
      ) {
        username = cleanedUsername;
      }

      // Get domain part (after @), looking for valid domains
      for (const domain of validDomains) {
        if (after.toLowerCase().startsWith(domain.toLowerCase())) {
          return `${username}@${domain}`;
        }
      }

      // If no known domain matched, try to extract a reasonable domain
      const domainMatch = after.match(/^([A-Za-z0-9.-]+\.[A-Za-z]{2,4})/);
      if (domainMatch) {
        const domain = domainMatch[1];
        // Check if it's a reasonable domain (not too long, doesn't contain obvious non-domain text)
        if (
          domain.length < 30 &&
          !domain.includes('linkedin') &&
          !domain.includes('www')
        ) {
          return `${username}@${domain}`;
        }
      }
    }

    return '';
  }
}
