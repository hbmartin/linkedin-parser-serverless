import {
  TextItem,
  WorkExperience,
  Position,
  StructuralSection,
} from '../types/structural.js';
import {
  cleanOrganizationNameText,
  isEducationSectionHeaderText,
  isExperienceSectionHeaderText,
  isSectionHeaderText,
  looksLikeOrganizationNameText,
  looksLikePersonNameText,
  looksLikePositionTitleText,
} from '../utils/profile-text.js';
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
        item => item.y < experienceStartY && item.y > experienceEndY
      );
    }

    // Group text by proximity with smaller Y distance for better line separation
    const allGroups = StructuralParser.groupTextByProximity(relevantItems, 3);
    const allLines = StructuralParser.combineGroupedText(allGroups);
    const { lines, groups } = this.extractExperienceLines(allLines, allGroups);

    // Classify each line
    const classifiedSections = this.classifyLines(lines, groups);

    // Build work experiences
    const workExperiences = this.buildWorkExperiences(classifiedSections);

    return workExperiences;
  }

  private static extractExperienceLines(
    lines: string[],
    groups: TextItem[][]
  ): { lines: string[]; groups: TextItem[][] } {
    const experienceStartIndex = lines.findIndex(line =>
      isExperienceSectionHeaderText(line)
    );

    if (experienceStartIndex === -1) {
      return { lines, groups };
    }

    const educationStartOffset = lines
      .slice(experienceStartIndex + 1)
      .findIndex(line => isEducationSectionHeaderText(line));
    const experienceEndIndex =
      educationStartOffset === -1
        ? lines.length
        : experienceStartIndex + 1 + educationStartOffset;

    return {
      lines: lines.slice(experienceStartIndex + 1, experienceEndIndex),
      groups: groups.slice(experienceStartIndex + 1, experienceEndIndex),
    };
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
    if (lowerLine === 'experience' || lowerLine === 'experiência') {
      return 'other';
    }

    // Duration detection
    if (this.looksLikeDuration(line)) {
      return 'duration';
    }

    // Position detection - job titles
    if (this.looksLikePosition(line)) {
      return 'position';
    }

    // Organization detection - usually larger font, short line, followed by duration or position
    if (this.looksLikeOrganization(line, fontSize, index, allLines)) {
      return 'organization';
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
    const normalizedLine = line.trim();

    if (
      normalizedLine.length > 80 ||
      this.looksLikeDuration(normalizedLine) ||
      this.looksLikeLocation(normalizedLine) ||
      this.looksLikePosition(normalizedLine) ||
      isSectionHeaderText(normalizedLine) ||
      looksLikePersonNameText(normalizedLine)
    ) {
      return false;
    }

    // Look ahead for duration or position indicators
    const nextFewLines = allLines.slice(index + 1, index + 4);
    const hasJobDetailsAfter = nextFewLines.some(
      nextLine =>
        this.looksLikeDuration(nextLine) ||
        this.looksLikePosition(nextLine) ||
        /^\d+\s+(years?|months?|anos?|meses?)/.test(nextLine)
    );

    return (
      hasJobDetailsAfter &&
      looksLikeOrganizationNameText(normalizedLine) &&
      (fontSize > 10 || normalizedLine.length <= 40)
    );
  }

  private static looksLikePosition(line: string): boolean {
    return (
      looksLikePositionTitleText(line) &&
      !this.looksLikeDuration(line) &&
      !this.looksLikeLocation(line)
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
    const normalizedLine = this.normalizeLocationText(line);

    // Common location patterns
    const locationPatterns = [
      /^[A-Z][A-Za-z\s]+,\s*[A-Z\s]{2,}$/, // City, ST
      /^[A-Z][A-Za-z\s]+,\s*[A-Z][A-Za-z\s]+$/, // City, State
      /^[A-Z][A-Za-z\s]+,\s*[A-Z][A-Za-z\s]+,\s*[A-Z][A-Za-z\s]+/, // City, State, Country
      /^Greater\s+[A-Z][A-Za-z\s]+(?:Area|,\s*[A-Z\s]{2,})/,
      /^(California|New York|Texas|Florida|United States|Brasil|Brazil|Rio de Janeiro|São Paulo)$/i,
    ];

    return (
      normalizedLine.length < 80 &&
      locationPatterns.some(pattern => pattern.test(normalizedLine)) &&
      !this.looksLikeDuration(normalizedLine)
    );
  }

  private static normalizeLocationText(text: string): string {
    return text
      .replace(/\bY\s+ork\b/g, 'York')
      .replace(/\bT\s+X\b/g, 'TX')
      .replace(/\s+,/g, ',')
      .replace(/,\s*/g, ', ')
      .trim();
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
          {
            const completedWorkExperience = this.completeWorkExperience({
              workExperience: currentWorkExperience,
              position: currentPosition,
              descriptionLines,
            });

            if (completedWorkExperience) {
              workExperiences.push(completedWorkExperience);
            }

            currentWorkExperience = null;
            currentPosition = null;
            descriptionLines = [];
          }

          // Start new work experience with clean organization name
          const cleanOrgName = this.extractCleanOrganizationName(section.text);
          if (cleanOrgName) {
            // Only create if we have a valid organization name
            currentWorkExperience = {
              organization: cleanOrgName,
              positions: [],
            };
          }
          break;

        case 'position':
          {
            const completedPosition = this.completePosition({
              position: currentPosition,
              descriptionLines,
            });

            if (completedPosition && currentWorkExperience) {
              currentWorkExperience.positions = [
                ...(currentWorkExperience.positions ?? []),
                completedPosition,
              ];
            }
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
            currentPosition.location = this.normalizeLocationText(section.text);
          }
          break;

        case 'description':
          descriptionLines.push(section.text);
          break;
      }
    }

    // Save final work experience
    const completedWorkExperience = this.completeWorkExperience({
      workExperience: currentWorkExperience,
      position: currentPosition,
      descriptionLines,
    });

    if (completedWorkExperience) {
      workExperiences.push(completedWorkExperience);
    }

    return workExperiences;
  }

  private static completeWorkExperience({
    workExperience,
    position,
    descriptionLines,
  }: {
    workExperience: Partial<WorkExperience> | null;
    position: Partial<Position> | null;
    descriptionLines: string[];
  }): WorkExperience | undefined {
    if (!workExperience?.organization) {
      return undefined;
    }

    const completedPosition = this.completePosition({
      position,
      descriptionLines,
    });

    return {
      organization: workExperience.organization,
      totalDuration: workExperience.totalDuration,
      positions: completedPosition
        ? [...(workExperience.positions ?? []), completedPosition]
        : (workExperience.positions ?? []),
    };
  }

  private static completePosition({
    position,
    descriptionLines,
  }: {
    position: Partial<Position> | null;
    descriptionLines: string[];
  }): Position | undefined {
    if (!position?.title) {
      return undefined;
    }

    return {
      title: position.title,
      duration: position.duration ?? '',
      location: position.location
        ? this.normalizeLocationText(position.location)
        : undefined,
      description: descriptionLines.join(' ').trim(),
    };
  }

  private static extractCleanOrganizationName(text: string): string {
    return cleanOrganizationNameText(text) ?? '';
  }

  private static extractCleanDuration(text: string): string {
    const normalizedText = text
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Common duration patterns to extract
    const durationPatterns = [
      // Full date ranges with years
      /\b([A-Z][a-z]+\s+\d{4}\s*-\s*[A-Z][a-z]+\s+\d{4})\b/i,
      /\b([A-Z][a-z]+\s+\d{4}\s*-\s*Present)\b/i,
      /\b(\d{4}\s*-\s*\d{4})\b/,
      /\b(\d{4}\s*-\s*Present)\b/i,
      /\b((?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\s*[-–]\s*(?:(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}|presente|atual|present))\b/i,

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
      const match = normalizedText.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // If no specific pattern matched, try to clean up the text by removing obvious non-duration content
    let cleanText = normalizedText;

    // Remove bullet points and common leading text
    cleanText = cleanText.replace(/^[•\-\*]\s*/, '');
    cleanText = cleanText.replace(
      /^(Provided|Led|Managed|Built|Developed|Implemented|Created|Designed|Worked|Coordinated|Contributed)\s+.*?(?=\b[A-Z][a-z]+\s+\d{4}|\d{4})/i,
      ''
    );

    // Extract just the date-like portions
    const datePortions: string[] = [];
    const dateRegex =
      /\b(?:[A-Z][a-z]+\s+\d{4}|\d{4}(?:\s*-\s*(?:[A-Z][a-z]+\s+\d{4}|\d{4}|Present))?|\(\d+\s+(?:years?|months?|anos?|meses?)(?:\s+\d+\s+(?:months?|meses?))?)\)/gi;

    let match: RegExpExecArray | null;
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

    return normalizedText;
  }
}
