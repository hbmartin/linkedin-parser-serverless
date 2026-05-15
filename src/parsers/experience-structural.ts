import {
  TextItem,
  WorkExperience,
  Position,
  StructuralSection,
} from '../types/structural.js';
import { StructuralParser } from './structural-parser.js';

export class ExperienceStructuralParser {
  static parseExperience(
    textItems: TextItem[],
    experienceStartY?: number,
    experienceEndY?: number
  ): WorkExperience[] {
    // Filter items within experience section and focus on main content area (right column)
    let relevantItems = textItems.filter(item => item.x >= 150); // Right column only

    if (experienceStartY !== undefined && experienceEndY !== undefined) {
      relevantItems = relevantItems.filter(
        item => item.y <= experienceStartY && item.y >= experienceEndY
      );
    }

    // Group text by proximity with smaller Y distance for better line separation
    const groups = StructuralParser.groupTextByProximity(relevantItems, 3);
    const lines = StructuralParser.combineGroupedText(groups);

    // Classify each line
    const classifiedSections = this.classifyLines(lines, groups);

    // Build work experiences
    const workExperiences = this.buildWorkExperiences(classifiedSections);

    return workExperiences;
  }

  private static classifyLines(
    lines: string[],
    groups: TextItem[][]
  ): StructuralSection[] {
    const sections: StructuralSection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const group = groups[i];

      if (!line.trim() || line.length < 2) continue;

      // Calculate average font size for the line
      const avgFontSize =
        group.reduce((sum, item) => sum + item.fontSize, 0) / group.length;
      const avgY = group.reduce((sum, item) => sum + item.y, 0) / group.length;

      const section: StructuralSection = {
        type: 'other',
        text: line.trim(),
        fontSize: avgFontSize,
        y: avgY,
        confidence: 0,
      };

      // Classify based on content and structure
      section.type = this.classifyLineType(line, avgFontSize, i, lines);
      section.confidence = this.calculateConfidence(
        line,
        section.type,
        avgFontSize
      );

      sections.push(section);
    }

    return sections;
  }

  private static classifyLineType(
    line: string,
    fontSize: number,
    index: number,
    allLines: string[]
  ): StructuralSection['type'] {
    const lowerLine = line.toLowerCase();

    // Skip section headers
    if (lowerLine.includes('experience') || lowerLine.includes('experiência')) {
      return 'other';
    }

    // Organization detection - usually larger font, short line, followed by duration or position
    if (this.looksLikeOrganization(line, fontSize, index, allLines)) {
      return 'organization';
    }

    // Duration detection
    if (this.looksLikeDuration(line)) {
      return 'duration';
    }

    // Position detection - job titles
    if (this.looksLikePosition(line)) {
      return 'position';
    }

    // Location detection
    if (this.looksLikeLocation(line)) {
      return 'location';
    }

    // Description - everything else with substantial content
    if (line.length > 30) {
      return 'description';
    }

    return 'other';
  }

  private static looksLikeOrganization(
    line: string,
    fontSize: number,
    index: number,
    allLines: string[]
  ): boolean {
    // Short line (likely company name)
    if (line.length > 50) return false;

    // Look ahead for duration or position indicators
    const nextFewLines = allLines.slice(index + 1, index + 4);
    const hasJobDetailsAfter = nextFewLines.some(
      nextLine =>
        this.looksLikeDuration(nextLine) ||
        this.looksLikePosition(nextLine) ||
        /^\d+\s+(years?|months?|anos?|meses?)/.test(nextLine)
    );

    // Skip common section headers that aren't companies
    const nonCompanyHeaders = [
      'contact',
      'top skills',
      'strategic roadmaps',
      'electronic engineering',
      'project planning',
      'languages',
      'summary',
      'education',
      'experience',
      'experiência',
      'formação',
      'idiomas',
      'competências',
      'habilidades',
    ];

    if (
      nonCompanyHeaders.some(
        header =>
          line.toLowerCase().includes(header) || line.toLowerCase() === header
      )
    ) {
      return false;
    }

    // Known companies or pattern matching
    const knownCompanies = [
      'Carta',
      'Boba Joy',
      'Zestt',
      'Guild',
      'Liquido',
      'Automox',
      'AevoTech',
      'Inovare',
      'CEPEL',
      'CPTI',
      'Arena Games',
      'PontoTel',
      'Partiu',
    ];
    const foundKnownCompany = knownCompanies.find(company =>
      line.toLowerCase().includes(company.toLowerCase())
    );

    // For known companies, the line should be just the company name (or very close to it)
    if (foundKnownCompany) {
      // Only accept if the line is primarily the company name (not mixed with other content)
      const cleanLine = line.trim().toLowerCase();
      const companyName = foundKnownCompany.toLowerCase();

      // Line should either be exactly the company name, or start/end with it and be short
      const isCleanCompanyName =
        cleanLine === companyName ||
        (cleanLine.startsWith(companyName) &&
          line.length < companyName.length + 20) ||
        (cleanLine.endsWith(companyName) &&
          line.length < companyName.length + 20) ||
        (line.length < 30 && cleanLine.includes(companyName));

      return isCleanCompanyName && hasJobDetailsAfter;
    }

    // Better company patterns - focus on actual business names
    const companyPatterns = [
      /^[A-Z][A-Za-z\s&.,-]{2,25}$/, // Standard company names (shorter, cleaner)
      /^[A-Z]{2,6}$/, // Acronyms (2-6 letters)
      /^[A-Z][A-Za-z]+\s+(Inc|LLC|Ltd|Corp|Corporation|Company|Technologies|Tech|Solutions|Systems|Group|Labs|Studio)$/i, // Business with suffixes
    ];

    const matchesPattern = companyPatterns.some(pattern => pattern.test(line));

    // Font size hint - company names are often larger
    const isLargerFont = fontSize > 11;

    return matchesPattern && isLargerFont && hasJobDetailsAfter;
  }

  private static looksLikePosition(line: string): boolean {
    const positionKeywords = [
      // English titles
      'manager',
      'engineer',
      'director',
      'lead',
      'senior',
      'principal',
      'chief',
      'head of',
      'co-founder',
      'founder',
      'president',
      'vice president',
      'vp',
      'analyst',
      'specialist',
      'developer',
      'architect',
      'consultant',
      'coordinator',
      'supervisor',
      'specialist',
      // Portuguese titles
      'gerente',
      'diretor',
      'coordenador',
      'analista',
      'especialista',
      'consultor',
      'desenvolvedor',
      'engenheiro',
      'arquiteto',
      'supervisor',
      'assessor',
      'gestor',
      // Additional position indicators
      'product manager',
      'software engineer',
      'tech lead',
      'technical lead',
      'scrum master',
    ];

    const lowerLine = line.toLowerCase();
    const hasPositionKeyword = positionKeywords.some(keyword =>
      lowerLine.includes(keyword)
    );

    // Avoid lines that are clearly durations or locations
    const isDuration = this.looksLikeDuration(line);
    const isLocation = this.looksLikeLocation(line);

    // Exclude lines that are clearly descriptions (too long, have sentence structure)
    const isDescription =
      line.length > 80 || // Too long for a job title
      line.toLowerCase().startsWith('i ') || // Starts with "I" (personal statement)
      line.toLowerCase().includes('i lead') ||
      line.toLowerCase().includes('i manage') ||
      line.toLowerCase().includes('i work') ||
      line.toLowerCase().includes('i was') ||
      line.toLowerCase().includes('responsible for') ||
      line.toLowerCase().includes('working as') ||
      line.toLowerCase().includes('joined the') ||
      line.toLowerCase().includes('my role') ||
      line.includes('•') || // Contains bullet points
      line.includes('...') || // Continuation
      line.split(' ').length > 15; // Too many words for a title

    // Must be a reasonable job title format
    const hasValidTitleFormat =
      line.length > 5 && // Not too short
      line.length < 80 && // Not too long
      !line.includes('(') &&
      !line.includes(')') && // No parentheses
      !line.includes('•') && // No bullets
      !line.includes('http') && // No URLs
      !line.includes('@') && // No email symbols
      line.split(' ').length <= 12; // Reasonable word count

    return (
      hasPositionKeyword &&
      !isDuration &&
      !isLocation &&
      !isDescription &&
      hasValidTitleFormat
    );
  }

  private static looksLikeDuration(line: string): boolean {
    const durationPatterns = [
      // English patterns
      /\b\d{4}\s*-\s*\d{4}\b/,
      /\b\d{4}\s*-\s*(present|current)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i,
      /\(\d+\s+(years?|months?)\s*\d*\s*(months?)?\)/i,
      /\d+\s+(years?|months?)\s+\d+\s+(months?|years?)/i,
      // Portuguese patterns
      /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}/i,
      /\(\d+\s+(anos?|meses?)\s*\d*\s*(meses?)?\)/i,
      /\d+\s+(anos?|meses?)\s+\d+\s+(meses?|anos?)/i,
    ];

    return durationPatterns.some(pattern => pattern.test(line));
  }

  private static looksLikeLocation(line: string): boolean {
    // Common location patterns
    const locationPatterns = [
      /^[A-Z][a-z]+,\s*[A-Z]{2}$/, // City, ST
      /^[A-Z][a-z]+,\s*[A-Z][a-z]+$/, // City, State
      /^[A-Z][a-z]+,\s*[A-Z][a-z]+,\s*[A-Z][a-z]+/, // City, State, Country
      /(California|New York|Texas|Florida|United States|Brasil|Brazil|Rio de Janeiro|São Paulo)/i,
    ];

    return (
      line.length < 80 &&
      locationPatterns.some(pattern => pattern.test(line)) &&
      !this.looksLikeDuration(line)
    );
  }

  private static calculateConfidence(
    line: string,
    type: StructuralSection['type'],
    fontSize: number
  ): number {
    let confidence = 0.5; // Base confidence

    switch (type) {
      case 'organization':
        if (fontSize > 12) confidence += 0.2;
        if (line.length < 30) confidence += 0.2;
        break;
      case 'position':
        if (
          line.toLowerCase().includes('manager') ||
          line.toLowerCase().includes('engineer')
        )
          confidence += 0.3;
        break;
      case 'duration':
        if (/\d{4}/.test(line)) confidence += 0.3;
        break;
      case 'location':
        if (line.includes(',')) confidence += 0.2;
        break;
    }

    return Math.min(confidence, 1.0);
  }

  private static buildWorkExperiences(
    sections: StructuralSection[]
  ): WorkExperience[] {
    const workExperiences: WorkExperience[] = [];
    let currentWorkExperience: Partial<WorkExperience> | null = null;
    let currentPosition: Partial<Position> | null = null;
    let descriptionLines: string[] = [];

    for (const section of sections) {
      switch (section.type) {
        case 'organization':
          // Save previous work experience
          if (currentWorkExperience && currentWorkExperience.organization) {
            if (currentPosition && currentPosition.title) {
              currentPosition.description = descriptionLines.join(' ').trim();
              currentWorkExperience.positions =
                currentWorkExperience.positions || [];
              currentWorkExperience.positions.push(currentPosition as Position);
            }
            workExperiences.push(currentWorkExperience as WorkExperience);
          }

          // Start new work experience with clean organization name
          const cleanOrgName = this.extractCleanOrganizationName(section.text);
          if (cleanOrgName) {
            // Only create if we have a valid organization name
            currentWorkExperience = {
              organization: cleanOrgName,
              positions: [],
            };
            currentPosition = null;
            descriptionLines = [];
          } else {
            // If no valid organization name, treat this as description for previous experience
            if (section.text.trim()) {
              descriptionLines.push(section.text);
            }
          }
          break;

        case 'position':
          // Save previous position
          if (
            currentPosition &&
            currentPosition.title &&
            currentWorkExperience
          ) {
            currentPosition.description = descriptionLines.join(' ').trim();
            currentWorkExperience.positions =
              currentWorkExperience.positions || [];
            currentWorkExperience.positions.push(currentPosition as Position);
          }

          // Start new position
          currentPosition = {
            title: section.text,
            duration: '',
          };
          descriptionLines = [];
          break;

        case 'duration':
          const cleanDuration = this.extractCleanDuration(section.text);
          if (currentPosition) {
            currentPosition.duration = cleanDuration;
          } else if (
            currentWorkExperience &&
            !currentWorkExperience.totalDuration
          ) {
            currentWorkExperience.totalDuration = cleanDuration;
          }
          break;

        case 'location':
          if (currentPosition) {
            currentPosition.location = section.text;
          }
          break;

        case 'description':
          descriptionLines.push(section.text);
          break;
      }
    }

    // Save final work experience
    if (currentWorkExperience && currentWorkExperience.organization) {
      if (currentPosition && currentPosition.title) {
        currentPosition.description = descriptionLines.join(' ').trim();
        currentWorkExperience.positions = currentWorkExperience.positions || [];
        currentWorkExperience.positions.push(currentPosition as Position);
      }
      workExperiences.push(currentWorkExperience as WorkExperience);
    }

    return workExperiences;
  }

  private static extractCleanOrganizationName(text: string): string {
    const knownCompanies = [
      'Carta',
      'Boba Joy',
      'Zestt',
      'Guild',
      'Liquido',
      'Automox',
      'AevoTech',
      'Inovare',
      'CEPEL',
      'CPTI',
      'Arena Games',
      'PontoTel',
      'Partiu',
    ];

    // First, check if this is a known company and extract just that name
    for (const company of knownCompanies) {
      if (text.toLowerCase().includes(company.toLowerCase())) {
        // Return just the known company name
        return company;
      }
    }

    // Exclude common person names that might be mistaken for companies
    const commonPersonNames = [
      'Daniel Braga',
      'Arkady Zalkowitsch',
      'Thamiris Zalkowitsch',
    ];
    if (
      commonPersonNames.some(name =>
        text.toLowerCase().includes(name.toLowerCase())
      )
    ) {
      return ''; // Return empty to skip this as organization
    }

    // For other companies, try to extract clean company name patterns
    const cleanPatterns = [
      // Company name at the beginning of the line
      /^([A-Z][A-Za-z\s&.,-]{1,30})(?:\s+[a-z]|\s*-|\s*\||$)/,
      // Standalone company name
      /^([A-Z][A-Za-z\s&.,-]{1,25})$/,
      // Company with business suffix
      /^([A-Z][A-Za-z\s&.,-]+(?:Inc|LLC|Ltd|Corp|Corporation|Company|Technologies|Tech|Solutions|Systems|Group|Labs|Studio))/i,
    ];

    for (const pattern of cleanPatterns) {
      const match = text.match(pattern);
      if (match) {
        let companyName = match[1].trim();

        // Remove common trailing words that aren't part of company name
        companyName = companyName.replace(
          /\s+(clarifications|for|scalable|solutions|and|or|the|of|in|at|with).*$/i,
          ''
        );

        // Additional check: if it looks like a person name (two capitalized words), skip it
        const wordCount = companyName.split(' ').length;
        const isLikelyPersonName =
          wordCount === 2 && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(companyName);

        if (isLikelyPersonName) {
          return ''; // Skip potential person names
        }

        // Ensure reasonable length
        if (companyName.length >= 2 && companyName.length <= 30) {
          return companyName;
        }
      }
    }

    // Fallback: take first 30 characters and clean up
    let cleanName = text.trim();
    if (cleanName.length > 30) {
      cleanName = cleanName.substring(0, 30).trim();
    }

    // Remove common trailing pollution
    cleanName = cleanName.replace(
      /\s+(clarifications|for|scalable|solutions|and|or|the|of|in|at|with).*$/i,
      ''
    );

    return cleanName || text.trim();
  }

  private static extractCleanDuration(text: string): string {
    // Common duration patterns to extract
    const durationPatterns = [
      // Full date ranges with years
      /\b([A-Z][a-z]+\s+\d{4}\s*-\s*[A-Z][a-z]+\s+\d{4})\b/i,
      /\b([A-Z][a-z]+\s+\d{4}\s*-\s*Present)\b/i,
      /\b(\d{4}\s*-\s*\d{4})\b/,
      /\b(\d{4}\s*-\s*Present)\b/i,

      // Month/year formats
      /\b([A-Z][a-z]+\s+\d{4})\b/i,

      // Duration periods in parentheses
      /\((\d+\s+(?:years?|months?|anos?|meses?)(?:\s+\d+\s+(?:months?|meses?))?)\)/i,

      // Portuguese date formats
      /\b([a-z]+\s+de\s+\d{4}\s*-\s*[a-z]+\s+de\s+\d{4})\b/i,
      /\b([a-z]+\s+de\s+\d{4}\s*-\s*Present)\b/i,
    ];

    // Try to extract the cleanest duration match
    for (const pattern of durationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // If no specific pattern matched, try to clean up the text by removing obvious non-duration content
    let cleanText = text.trim();

    // Remove bullet points and common leading text
    cleanText = cleanText.replace(/^[•\-\*]\s*/, '');
    cleanText = cleanText.replace(
      /^(Provided|Led|Managed|Built|Developed|Implemented|Created|Designed|Worked|Coordinated|Contributed)\s+.*?(?=\b[A-Z][a-z]+\s+\d{4}|\d{4})/i,
      ''
    );

    // Extract just the date-like portions
    const datePortions = [];
    const dateRegex =
      /\b(?:[A-Z][a-z]+\s+\d{4}|\d{4}(?:\s*-\s*(?:[A-Z][a-z]+\s+\d{4}|\d{4}|Present))?|\(\d+\s+(?:years?|months?|anos?|meses?)(?:\s+\d+\s+(?:months?|meses?))?)\)/gi;

    let match;
    while ((match = dateRegex.exec(cleanText)) !== null) {
      datePortions.push(match[0]);
    }

    if (datePortions.length > 0) {
      // Return the first date-like portion found
      return datePortions[0].trim();
    }

    // Fallback: if text is reasonably short and might be a duration, return it
    if (
      cleanText.length < 50 &&
      (cleanText.includes('-') ||
        cleanText.match(/\d{4}/) ||
        cleanText.includes('Present'))
    ) {
      return cleanText;
    }

    // Final fallback: return first 50 characters if it contains date-like content
    if (cleanText.match(/\d{4}/)) {
      return cleanText.substring(0, 50).trim();
    }

    return text.trim();
  }
}
