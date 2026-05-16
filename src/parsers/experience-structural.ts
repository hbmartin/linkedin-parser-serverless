import {
  TextItem,
  WorkExperience,
  Position,
  StructuralSection,
} from '../types/structural.js';
import type {
  ParsedSectionResult,
  SectionParseWarning,
} from '../types/profile.js';
import {
  extractProfileDateRangeText,
  looksLikeDateRangeText,
  parseProfileDateRange,
} from '../utils/date-parser.js';
import {
  cleanOrganizationNameText,
  isEducationSectionHeaderText,
  isExperienceSectionHeaderText,
  isLikelyLocationText,
  isSectionHeaderText,
  looksLikeOrganizationNameText,
  looksLikePersonNameText,
  looksLikePositionTitleText,
} from '../utils/profile-text.js';
import {
  createGroupedTextItemParserLines,
  type NormalizedParserLine,
} from '../utils/parser-lines.js';
import { StructuralParser } from './structural-parser.js';

type ExperienceLineState =
  | 'seeking_company'
  | 'seeking_title'
  | 'seeking_dates'
  | 'in_description';

export class ExperienceStructuralParser {
  private static readonly MIN_DESCRIPTION_LINE_LENGTH = 30;
  private static readonly MIN_DESCRIPTION_CONTINUATION_CONTEXT_LENGTH = 20;

  static parseExperience(
    textItems: TextItem[],
    experienceStartY?: number,
    experienceEndY?: number
  ): WorkExperience[] {
    return this.parseExperienceWithWarnings(
      textItems,
      experienceStartY,
      experienceEndY
    ).value;
  }

  static parseExperienceWithWarnings(
    textItems: TextItem[],
    experienceStartY?: number,
    experienceEndY?: number
  ): ParsedSectionResult<WorkExperience[]> {
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
    const parserLines = createGroupedTextItemParserLines(
      lines.map((line, index) => {
        const group = groups[index];
        const x = Math.min(...group.map(item => item.x));
        const y = group.reduce((sum, item) => sum + item.y, 0) / group.length;
        const fontSize =
          group.reduce((sum, item) => sum + item.fontSize, 0) / group.length;

        return {
          fontSize,
          text: line,
          x,
          y,
        };
      })
    );

    // Classify each line
    const classifiedSections = this.classifyLines(parserLines);

    // Build work experiences
    const workExperiences = this.buildWorkExperiences(classifiedSections);

    return {
      value: workExperiences,
      warnings: this.createExperienceWarnings(workExperiences),
    };
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
    parserLines: NormalizedParserLine[]
  ): StructuralSection[] {
    const sections: StructuralSection[] = [];
    let state: ExperienceLineState = 'seeking_company';

    for (let index = 0; index < parserLines.length; index++) {
      const parserLine = parserLines[index];
      const line = parserLine.text;

      if (!line.trim() || line.length < 2) continue;

      const fontSize = parserLine.fontSize ?? 0;
      const y = parserLine.y ?? 0;

      const section: StructuralSection = {
        type: 'other',
        text: line.trim(),
        fontSize,
        y,
        confidence: 0,
      };

      section.type = this.classifyLineType({
        allLines: parserLines,
        index,
        line: parserLine,
        state,
      });
      state = this.nextState(state, section.type);
      section.confidence = this.calculateConfidence(
        line,
        section.type,
        fontSize
      );

      sections.push(section);
    }

    return sections;
  }

  private static classifyLineType({
    allLines,
    index,
    line,
    state,
  }: {
    allLines: NormalizedParserLine[];
    index: number;
    line: NormalizedParserLine;
    state: ExperienceLineState;
  }): StructuralSection['type'] {
    const text = line.text;
    const lowerLine = text.toLowerCase();

    // Skip section headers
    if (lowerLine === 'experience' || lowerLine === 'experiência') {
      return 'other';
    }

    const lineTexts = allLines.map(candidate => candidate.text);

    switch (state) {
      case 'seeking_company':
        return this.looksLikeOrganization(
          text,
          line.fontSize ?? 0,
          index,
          lineTexts,
          { allowPersonLikeName: false }
        )
          ? 'organization'
          : this.fallbackLineType(text, line.fontSize ?? 0, index, lineTexts);
      case 'seeking_title':
        if (this.looksLikeDuration(text)) {
          return 'duration';
        }

        if (this.looksLikePosition(text)) {
          return 'position';
        }

        if (
          this.looksLikeOrganization(
            text,
            line.fontSize ?? 0,
            index,
            lineTexts,
            { allowPersonLikeName: false }
          )
        ) {
          return 'organization';
        }

        return this.fallbackLineType(
          text,
          line.fontSize ?? 0,
          index,
          lineTexts
        );
      case 'seeking_dates':
        if (this.looksLikeDuration(text)) {
          return 'duration';
        }

        if (this.looksLikeLocation(text)) {
          return 'location';
        }

        if (
          this.looksLikeOrganization(
            text,
            line.fontSize ?? 0,
            index,
            lineTexts,
            { allowPersonLikeName: false }
          )
        ) {
          return 'organization';
        }

        if (this.looksLikePosition(text)) {
          return 'position';
        }

        return text.length > 15 ? 'description' : 'other';
      case 'in_description':
        if (this.isExperienceNoiseLine(text)) {
          return 'other';
        }

        if (
          this.looksLikeOrganization(
            text,
            line.fontSize ?? 0,
            index,
            lineTexts,
            { allowPersonLikeName: true }
          )
        ) {
          return 'organization';
        }

        if (this.looksLikeDuration(text)) {
          return 'duration';
        }

        if (this.looksLikeLocation(text)) {
          return 'location';
        }

        if (this.looksLikePosition(text)) {
          return 'position';
        }

        if (
          this.looksLikeDescriptionContinuationLine(
            text,
            lineTexts[index - 1] ?? undefined
          )
        ) {
          return 'description';
        }

        if (
          this.looksLikeDescriptionLine(text, lineTexts[index - 1] ?? undefined)
        ) {
          return 'description';
        }

        return 'other';
    }
  }

  private static nextState(
    currentState: ExperienceLineState,
    sectionType: StructuralSection['type']
  ): ExperienceLineState {
    switch (sectionType) {
      case 'organization':
        return 'seeking_title';
      case 'position':
        return 'seeking_dates';
      case 'duration':
      case 'location':
      case 'description':
        return currentState === 'seeking_company'
          ? 'seeking_company'
          : 'in_description';
      case 'other':
        return currentState;
    }
  }

  private static fallbackLineType(
    line: string,
    fontSize: number,
    index: number,
    allLines: string[]
  ): StructuralSection['type'] {
    if (this.looksLikeDuration(line)) {
      return 'duration';
    }

    if (this.looksLikeLocation(line)) {
      return 'location';
    }

    if (this.looksLikeOrganization(line, fontSize, index, allLines)) {
      return 'organization';
    }

    if (this.looksLikePosition(line)) {
      return 'position';
    }

    return line.length > this.MIN_DESCRIPTION_LINE_LENGTH
      ? 'description'
      : 'other';
  }

  private static looksLikeOrganization(
    line: string,
    fontSize: number,
    index: number,
    allLines: string[],
    options: { allowPersonLikeName: boolean } = { allowPersonLikeName: false }
  ): boolean {
    const normalizedLine = line.trim();

    if (
      normalizedLine.length > 80 ||
      /^[a-z]/.test(normalizedLine) ||
      this.looksLikeDuration(normalizedLine) ||
      this.looksLikeLocation(normalizedLine) ||
      this.looksLikePosition(normalizedLine) ||
      isSectionHeaderText(normalizedLine) ||
      (!options.allowPersonLikeName && looksLikePersonNameText(normalizedLine))
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

    const hasOrganizationShape =
      looksLikeOrganizationNameText(normalizedLine) ||
      (options.allowPersonLikeName &&
        this.looksLikeVisualOrganizationHeaderText(normalizedLine));

    return (
      hasJobDetailsAfter &&
      hasOrganizationShape &&
      (fontSize > 10 || normalizedLine.length <= 40)
    );
  }

  private static looksLikeVisualOrganizationHeaderText(line: string): boolean {
    const normalizedLine = line.trim();

    if (
      normalizedLine.length < 2 ||
      normalizedLine.length > 80 ||
      normalizedLine.includes('@') ||
      normalizedLine.includes('•') ||
      /https?:\/\//i.test(normalizedLine) ||
      /^page\s+\d+\s+of\s+\d+$/i.test(normalizedLine) ||
      this.looksLikeDuration(normalizedLine) ||
      this.looksLikeLocation(normalizedLine) ||
      this.looksLikePosition(normalizedLine) ||
      isSectionHeaderText(normalizedLine)
    ) {
      return false;
    }

    const words = normalizedLine.split(/\s+/).filter(Boolean);

    return (
      words.length > 0 &&
      words.length <= 5 &&
      words.every(word => /^[\p{Lu}0-9][\p{L}\p{M}0-9&.'+!-]*$/u.test(word))
    );
  }

  private static looksLikePosition(line: string): boolean {
    if (/[.!?]$/.test(line.trim())) {
      return false;
    }

    return (
      looksLikePositionTitleText(line) &&
      !this.looksLikeDuration(line) &&
      !this.looksLikeLocation(line)
    );
  }

  private static looksLikeDuration(line: string): boolean {
    return looksLikeDateRangeText(line);
  }

  private static isExperienceNoiseLine(line: string): boolean {
    return /^page\s+\d+\s+of\s+\d+$/i.test(line.trim());
  }

  private static looksLikeDescriptionLine(
    line: string,
    previousLine?: string
  ): boolean {
    const normalizedLine = line.trim();
    const normalizedPreviousLine = previousLine?.trim();

    // Longer lines are usually prose, while short lines need continuation cues.
    if (normalizedLine.length > this.MIN_DESCRIPTION_LINE_LENGTH) {
      return true;
    }

    // Stock ticker fragments often appear in description text for public companies.
    if (/\$[A-Z]{1,8}\b/.test(normalizedLine)) {
      return true;
    }

    if (!normalizedPreviousLine) {
      return false;
    }

    // Short continuations rely on syntax: lowercase starts, sentence endings, or
    // previous-line connector words that imply the sentence is not finished.
    return (
      /^[a-z]/.test(normalizedLine) ||
      /[.!?]$/.test(normalizedLine) ||
      /\b(?:and|for|from|in|of|the|to|with)$/i.test(normalizedPreviousLine)
    );
  }

  private static looksLikeDescriptionContinuationLine(
    line: string,
    previousLine?: string
  ): boolean {
    const normalizedLine = line.trim();
    const normalizedPreviousLine = previousLine?.trim();

    if (!normalizedPreviousLine) {
      return false;
    }

    if (
      /\b(?:and|at|by|for|from|in|of|on|the|their|to|with)$/i.test(
        normalizedPreviousLine
      )
    ) {
      return true;
    }

    if (
      normalizedPreviousLine.length <
      this.MIN_DESCRIPTION_CONTINUATION_CONTEXT_LENGTH
    ) {
      return false;
    }

    return (
      /^[a-z]/.test(normalizedLine) ||
      (/[.!?]$/.test(normalizedLine) &&
        !looksLikeOrganizationNameText(normalizedLine) &&
        !this.looksLikeVisualOrganizationHeaderText(normalizedLine))
    );
  }

  private static looksLikeLocation(line: string): boolean {
    const normalizedLine = this.normalizeLocationText(line);

    if (/^[a-z]/.test(normalizedLine)) {
      return false;
    }

    // Common location patterns
    const locationPatterns = [
      /^[A-Z][A-Za-z\s]+,\s*[A-Z\s]{2,}$/, // City, ST
      /^[A-Z][A-Za-z\s]+,\s*[A-Z][A-Za-z\s]+$/, // City, State
      /^[A-Z][A-Za-z\s]+,\s*[A-Z][A-Za-z\s]+,\s*[A-Z][A-Za-z\s]+/, // City, State, Country
      /^Greater\s+[\p{Lu}][\p{L}\p{M}.'\-\s]+(?:Area|,\s*[\p{Lu}\s]{2,})?$/u,
      /^(?:Rua|R\.|Av\.?|Avenida|Alameda|Praça|Street|St\.|Avenue|Ave\.|Road|Rd\.)(?!\w)/iu,
      /^\d{5}(?:-\d{3})?$/,
      /^(California|New York|Texas|Florida|United States|Brasil|Brazil|Rio de Janeiro|São Paulo)$/i,
    ];

    return (
      normalizedLine.length < 120 &&
      !looksLikePositionTitleText(normalizedLine) &&
      (isLikelyLocationText(normalizedLine) ||
        locationPatterns.some(pattern => pattern.test(normalizedLine))) &&
      !this.looksLikeDuration(normalizedLine)
    );
  }

  private static normalizeLocationText(text: string): string {
    return text
      .replace(/\bY\s+ork\b/g, 'York')
      .replace(/,\s*([A-Z])\s+([A-Z])$/g, ', $1$2')
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
            const cleanOrgName = this.extractCleanOrganizationName(
              section.text
            );

            if (!cleanOrgName) {
              if (currentWorkExperience || currentPosition) {
                descriptionLines.push(section.text);
              }

              break;
            }

            const completedWorkExperience = this.completeWorkExperience({
              workExperience: currentWorkExperience,
              position: currentPosition,
              descriptionLines,
            });

            if (completedWorkExperience) {
              workExperiences.push(completedWorkExperience);
            }

            currentWorkExperience = {
              organization: cleanOrgName,
              positions: [],
            };
            currentPosition = null;
            descriptionLines = [];
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
            const locationText = currentPosition.location
              ? `${currentPosition.location} ${section.text}`
              : section.text;
            currentPosition.location = this.normalizeLocationText(locationText);
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

    const dates = position.duration
      ? parseProfileDateRange(position.duration)
      : undefined;

    return {
      ...(dates ? { dates } : {}),
      title: position.title,
      duration: position.duration ?? '',
      ...(position.location
        ? { location: this.normalizeLocationText(position.location) }
        : {}),
      description: descriptionLines.join(' ').trim(),
    };
  }

  private static extractCleanOrganizationName(
    text: string
  ): string | undefined {
    const cleanOrganizationName = cleanOrganizationNameText(text);

    if (cleanOrganizationName) {
      return cleanOrganizationName;
    }

    const normalizedText = text
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return this.looksLikeVisualOrganizationHeaderText(normalizedText)
      ? normalizedText
      : undefined;
  }

  private static extractCleanDuration(text: string): string {
    const normalizedText = text
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const parsedDurationText = extractProfileDateRangeText(normalizedText);

    if (parsedDurationText) {
      return parsedDurationText;
    }

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

  private static createExperienceWarnings(
    workExperiences: WorkExperience[]
  ): SectionParseWarning[] {
    const warnings: SectionParseWarning[] = [];
    let positionEntry = 0;

    workExperiences.forEach((workExperience, workExperienceIndex) => {
      if (workExperience.positions.length === 0) {
        warnings.push({
          code: 'section_parse_warning',
          entry: workExperienceIndex,
          field: 'positions',
          message: 'Could not extract any positions for experience entry',
          rawText: workExperience.organization,
          section: 'experience',
        });
      }

      workExperience.positions.forEach(position => {
        if (!position.duration) {
          warnings.push({
            code: 'section_parse_warning',
            entry: positionEntry,
            field: 'dates',
            message: 'Could not extract date range for experience entry',
            rawText: position.title,
            section: 'experience',
          });
        } else if (!position.dates) {
          warnings.push({
            code: 'section_parse_warning',
            entry: positionEntry,
            field: 'dates',
            message: 'Could not parse date range',
            rawText: position.duration,
            section: 'experience',
          });
        }
        positionEntry++;
      });
    });

    return warnings;
  }
}
