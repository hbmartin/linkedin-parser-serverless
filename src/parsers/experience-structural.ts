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
import { classifyLocationText } from '../utils/location-classifier.js';
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
import {
  createStructuralLines,
  type StructuralLine,
} from '../utils/structural-lines.js';
import { StructuralParser } from './structural-parser.js';

type ExperienceLineState =
  | 'seeking_company'
  | 'seeking_title'
  | 'seeking_dates'
  | 'in_description';

interface WrappedParserLineMergeParams {
  allLines: NormalizedParserLine[];
  combinedText: string;
  index: number;
  line: NormalizedParserLine;
  nextLine: NormalizedParserLine;
}

interface MergedParserLineParams {
  combinedText: string;
  index: number;
  line: NormalizedParserLine;
  nextLine: NormalizedParserLine;
}

interface CombinedOrganizationTitleLineParams {
  line: string;
  nextLine?: string;
}

interface CombinedOrganizationTitleLine {
  organization: string;
  title: string;
}

interface DescriptionLineParams {
  allLines: string[];
  index: number;
  line: string;
  previousLine?: string;
}

interface ExperienceHeaderCandidate {
  durationLine: NormalizedParserLine;
  locationLine?: NormalizedParserLine;
  organizationLine: NormalizedParserLine;
  score: number;
  titleLine: NormalizedParserLine;
  totalDurationLine?: NormalizedParserLine;
}

export class ExperienceStructuralParser {
  private static readonly EXPERIENCE_HEADER_ALIGNMENT_TOLERANCE = 12;
  private static readonly EXPERIENCE_HEADER_ACCEPTANCE_SCORE = 4;
  private static readonly EXPERIENCE_HEADER_DESCRIPTION_LOOKAHEAD = 3;
  private static readonly MIN_DESCRIPTION_LINE_LENGTH = 30;
  private static readonly MIN_DESCRIPTION_CONTINUATION_CONTEXT_LENGTH = 20;
  private static readonly DESCRIPTION_CONTINUATION_CONNECTOR_PATTERN =
    /\b(?:and|at|by|for|from|in|of|on|the|their|to|with)$/i;
  private static readonly WRAPPED_TITLE_KEYWORD_PATTERN =
    /\b(?:advisor|analyst|associate|board|ceo|chief|co[-\s]?founder|cofounder|director|engineer|executive|fellow|founder|manager|member|partner|president|producer|scientist|vp)\b/iu;
  private static readonly DURATION_WORD_PATTERN =
    /\b(?:yr|yrs|year|years|mo|mos|month|months|jahr|jahre|ano|anos|mes|mês|meses)\b/iu;
  private static readonly TOTAL_DURATION_LINE_PATTERN =
    /^(?:less than a year|\d+\s+(?:yr|yrs|year|years|mo|mos|month|months|ano|anos|mes|mês|meses|jahr|jahre)(?:\s+\d+\s+(?:yr|yrs|year|years|mo|mos|month|months|ano|anos|mes|mês|meses|jahr|jahre))?)$/iu;
  private static readonly MEDIA_DESCRIPTION_LINE_PATTERN =
    /^(?:(?:directed|executive\s+produced|produced|written)\s+by\s+.+|(?:documentary|feature|short|television|tv|web)\s+(?:film|series|show))$/iu;
  private static readonly ORGANIZATION_CONNECTOR_WORD_PATTERN =
    /^(?:a|an|and|at|by|da|de|di|do|du|for|in|la|le|of|on|or|than|the|to|van|von|with|à)$/iu;
  private static readonly COMBINED_ORGANIZATION_TITLE_LINE_PATTERN =
    /^(.+\b(?:Agency|AG|Company|Corp\.?|Corporation|GmbH\.?|Inc\.?|Limited|LLC|LLP|LP|Ltd\.?))\s+(.+)$/iu;
  private static readonly ORGANIZATION_SUFFIX_TITLE_FRAGMENT_PATTERN =
    /^(?:Agency|AG|Co\.?|Company|Corp\.?|Corporation|GmbH\.?|Inc\.?|Limited|LLC|LLP|LP|Ltd\.?)$/iu;
  private static readonly COMMA_SEPARATED_ORGANIZATION_SUFFIXES: ReadonlySet<string> =
    new Set([
      'company',
      'corp',
      'corporation',
      'gmbh',
      'inc',
      'labs',
      'llc',
      'llp',
      'lp',
      'ltd',
      'partners',
      'solutions',
      'systems',
      'technologies',
      'technology',
      'ventures',
    ]);
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
    const layout = StructuralParser.detectLayout(textItems);
    const initialStructuralLines = createStructuralLines({
      layout,
      textItems,
    });
    const hasSingleColumnMainCandidate = initialStructuralLines.some(
      line => line.column === 'single' && line.x >= 150
    );
    const hasLeftSingleColumnExperienceHeader = initialStructuralLines.some(
      line =>
        line.column === 'single' &&
        line.x < 150 &&
        isExperienceSectionHeaderText(line.text)
    );
    // Use the raw cutoff only when single-column detection has no left-side
    // Experience section to preserve.
    const structuralLines =
      layout.type === 'single-column' &&
      hasSingleColumnMainCandidate &&
      !hasLeftSingleColumnExperienceHeader
        ? createStructuralLines({
            layout,
            textItems: textItems.filter(item => item.x >= 150),
          })
        : initialStructuralLines;
    let relevantLines = structuralLines.filter(
      line => line.column === 'right' || line.column === 'single'
    );

    if (experienceStartY !== undefined && experienceEndY !== undefined) {
      relevantLines = relevantLines.filter(
        line => line.y < experienceStartY && line.y > experienceEndY
      );
    }

    const lines = this.extractExperienceStructuralLines(relevantLines);
    const parserLines = createGroupedTextItemParserLines(
      lines.map(line => {
        return {
          column: line.column,
          fontSize: line.fontSize,
          text: line.text,
          x: line.x,
          y: line.y,
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

  private static extractExperienceStructuralLines(
    lines: StructuralLine[]
  ): StructuralLine[] {
    const experienceStartIndex = lines.findIndex(line =>
      isExperienceSectionHeaderText(line.text)
    );

    if (experienceStartIndex === -1) {
      return lines;
    }

    const educationStartOffset = lines
      .slice(experienceStartIndex + 1)
      .findIndex(line => isEducationSectionHeaderText(line.text));
    const experienceEndIndex =
      educationStartOffset === -1
        ? lines.length
        : experienceStartIndex + 1 + educationStartOffset;

    return lines.slice(experienceStartIndex + 1, experienceEndIndex);
  }

  private static classifyLines(
    parserLines: NormalizedParserLine[]
  ): StructuralSection[] {
    const sections: StructuralSection[] = [];
    const normalizedParserLines = this.mergeWrappedHeaderLines(parserLines);
    const expandedParserLines = this.expandCombinedOrganizationTitleLines(
      normalizedParserLines
    );
    const canonicalHeaderLineTypes =
      this.createCanonicalHeaderLineTypes(expandedParserLines);
    let state: ExperienceLineState = 'seeking_company';

    for (let index = 0; index < expandedParserLines.length; index++) {
      const parserLine = expandedParserLines[index];
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

      section.type =
        canonicalHeaderLineTypes.get(index) ??
        this.classifyLineType({
          allLines: expandedParserLines,
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

  private static mergeWrappedHeaderLines(
    parserLines: NormalizedParserLine[]
  ): NormalizedParserLine[] {
    const mergedParserLines: NormalizedParserLine[] = [];

    for (let index = 0; index < parserLines.length; index++) {
      const parserLine = parserLines[index];
      const nextLine = parserLines[index + 1];

      if (!nextLine) {
        mergedParserLines.push({
          ...parserLine,
          index: mergedParserLines.length,
        });
        continue;
      }

      const combinedText = `${parserLine.text} ${nextLine.text}`.replace(
        /\s+/g,
        ' '
      );

      if (
        this.shouldMergeWrappedPositionTitle({
          allLines: parserLines,
          combinedText,
          index,
          line: parserLine,
          nextLine,
        }) ||
        this.shouldMergeWrappedOrganization({
          allLines: parserLines,
          combinedText,
          index,
          line: parserLine,
          nextLine,
        })
      ) {
        mergedParserLines.push(
          this.createMergedParserLine({
            combinedText,
            index: mergedParserLines.length,
            line: parserLine,
            nextLine,
          })
        );
        index++;
        continue;
      }

      mergedParserLines.push({
        ...parserLine,
        index: mergedParserLines.length,
      });
    }

    return mergedParserLines;
  }

  private static shouldMergeWrappedPositionTitle({
    allLines,
    combinedText,
    index,
    line,
    nextLine,
  }: WrappedParserLineMergeParams): boolean {
    const followingLine = this.nextContentLine(allLines, index + 2);

    return (
      followingLine !== undefined &&
      this.haveComparableHeaderFonts(line, nextLine) &&
      this.WRAPPED_TITLE_KEYWORD_PATTERN.test(line.text) &&
      this.looksLikePendingTitleContinuationLine(nextLine.text) &&
      this.looksLikeDuration(followingLine.text) &&
      this.looksLikePotentialPositionTitleLine(combinedText)
    );
  }

  private static shouldMergeWrappedOrganization({
    allLines,
    combinedText,
    index,
    line,
    nextLine,
  }: WrappedParserLineMergeParams): boolean {
    const titleLine = this.nextContentLine(allLines, index + 2);
    const durationLine = titleLine
      ? this.nextContentLine(allLines, titleLine.index + 1)
      : undefined;
    const hasWrappedOrganizationShape =
      this.looksLikeLongAcademicOrganizationHeaderText(combinedText) ||
      this.looksLikeWrappedOrganizationHeaderText(combinedText);

    return (
      titleLine !== undefined &&
      durationLine !== undefined &&
      this.haveComparableHeaderFonts(line, nextLine) &&
      !this.looksLikeDuration(line.text) &&
      !this.looksLikeDuration(nextLine.text) &&
      !this.looksLikePosition(line.text) &&
      !this.looksLikeLocation(line.text) &&
      hasWrappedOrganizationShape &&
      (this.looksLikePosition(titleLine.text) ||
        this.looksLikePotentialPositionTitleLine(titleLine.text)) &&
      this.looksLikeDuration(durationLine.text)
    );
  }

  private static nextContentLine(
    parserLines: NormalizedParserLine[],
    startIndex: number
  ): NormalizedParserLine | undefined {
    return parserLines
      .slice(startIndex)
      .find(line => !this.isExperienceNoiseLine(line.text));
  }

  private static haveComparableHeaderFonts(
    firstLine: NormalizedParserLine,
    secondLine: NormalizedParserLine
  ): boolean {
    if (firstLine.fontSize === undefined || secondLine.fontSize === undefined) {
      return true;
    }

    return Math.abs(firstLine.fontSize - secondLine.fontSize) <= 0.75;
  }

  private static createMergedParserLine({
    combinedText,
    index,
    line,
    nextLine,
  }: MergedParserLineParams): NormalizedParserLine {
    return {
      ...line,
      fontSize:
        line.fontSize !== undefined && nextLine.fontSize !== undefined
          ? Math.max(line.fontSize, nextLine.fontSize)
          : (line.fontSize ?? nextLine.fontSize),
      index,
      text: combinedText,
    };
  }

  private static expandCombinedOrganizationTitleLines(
    parserLines: NormalizedParserLine[]
  ): NormalizedParserLine[] {
    const expandedParserLines: NormalizedParserLine[] = [];

    for (let index = 0; index < parserLines.length; index++) {
      const parserLine = parserLines[index];
      const splitLine = this.splitCombinedOrganizationTitleLine({
        line: parserLine.text,
        nextLine: parserLines[index + 1]?.text,
      });

      if (!splitLine) {
        expandedParserLines.push({
          ...parserLine,
          index: expandedParserLines.length,
        });
        continue;
      }

      expandedParserLines.push({
        ...parserLine,
        index: expandedParserLines.length,
        text: splitLine.organization,
      });
      expandedParserLines.push({
        ...parserLine,
        index: expandedParserLines.length,
        text: splitLine.title,
      });
    }

    return expandedParserLines;
  }

  private static createCanonicalHeaderLineTypes(
    parserLines: NormalizedParserLine[]
  ): Map<number, StructuralSection['type']> {
    const lineTypes = new Map<number, StructuralSection['type']>();

    for (let index = 0; index < parserLines.length; index++) {
      if (lineTypes.has(index)) {
        continue;
      }

      const candidate = this.createExperienceHeaderCandidate(
        parserLines,
        index
      );

      if (
        !candidate ||
        candidate.score < this.EXPERIENCE_HEADER_ACCEPTANCE_SCORE
      ) {
        continue;
      }

      lineTypes.set(candidate.organizationLine.index, 'organization');

      if (candidate.totalDurationLine) {
        lineTypes.set(candidate.totalDurationLine.index, 'duration');
      }

      lineTypes.set(candidate.titleLine.index, 'position');
      lineTypes.set(candidate.durationLine.index, 'duration');

      if (candidate.locationLine) {
        lineTypes.set(candidate.locationLine.index, 'location');
      }
    }

    return lineTypes;
  }

  private static createExperienceHeaderCandidate(
    parserLines: NormalizedParserLine[],
    index: number
  ): ExperienceHeaderCandidate | undefined {
    const organizationLine = parserLines[index];

    if (
      !organizationLine ||
      !this.canStartCanonicalExperienceHeader(organizationLine.text)
    ) {
      return undefined;
    }

    const lineTexts = parserLines.map(line => line.text);
    const firstDetailLine = this.nextContentLine(parserLines, index + 1);

    if (!firstDetailLine) {
      return undefined;
    }

    if (this.looksLikeTotalDuration(firstDetailLine.text)) {
      return this.createMultiPositionHeaderCandidate({
        lineTexts,
        organizationLine,
        parserLines,
        totalDurationLine: firstDetailLine,
      });
    }

    return this.createSinglePositionHeaderCandidate({
      lineTexts,
      organizationLine,
      parserLines,
      titleLine: firstDetailLine,
    });
  }

  private static createSinglePositionHeaderCandidate({
    lineTexts,
    organizationLine,
    parserLines,
    titleLine,
  }: {
    lineTexts: string[];
    organizationLine: NormalizedParserLine;
    parserLines: NormalizedParserLine[];
    titleLine: NormalizedParserLine;
  }): ExperienceHeaderCandidate | undefined {
    if (!this.looksLikeCanonicalHeaderTitleLine(titleLine, lineTexts)) {
      return undefined;
    }

    const durationLine = this.nextContentLine(parserLines, titleLine.index + 1);

    if (!durationLine || !this.looksLikeDuration(durationLine.text)) {
      return undefined;
    }

    const locationLine = this.canonicalHeaderLocationLine({
      durationLine,
      parserLines,
    });
    const candidate: ExperienceHeaderCandidate = {
      ...(locationLine ? { locationLine } : {}),
      durationLine,
      organizationLine,
      score: 0,
      titleLine,
    };

    return {
      ...candidate,
      score: this.scoreExperienceHeaderCandidate(candidate, parserLines),
    };
  }

  private static createMultiPositionHeaderCandidate({
    lineTexts,
    organizationLine,
    parserLines,
    totalDurationLine,
  }: {
    lineTexts: string[];
    organizationLine: NormalizedParserLine;
    parserLines: NormalizedParserLine[];
    totalDurationLine: NormalizedParserLine;
  }): ExperienceHeaderCandidate | undefined {
    const titleLine = this.nextContentLine(
      parserLines,
      totalDurationLine.index + 1
    );

    if (
      !titleLine ||
      !this.looksLikeCanonicalHeaderTitleLine(titleLine, lineTexts)
    ) {
      return undefined;
    }

    const durationLine = this.nextContentLine(parserLines, titleLine.index + 1);

    if (!durationLine || !this.looksLikeDuration(durationLine.text)) {
      return undefined;
    }

    const locationLine = this.canonicalHeaderLocationLine({
      durationLine,
      parserLines,
    });
    const candidate: ExperienceHeaderCandidate = {
      ...(locationLine ? { locationLine } : {}),
      durationLine,
      organizationLine,
      score: 0,
      titleLine,
      totalDurationLine,
    };

    return {
      ...candidate,
      score: this.scoreExperienceHeaderCandidate(candidate, parserLines),
    };
  }

  private static canStartCanonicalExperienceHeader(line: string): boolean {
    const normalizedLine = line.trim();
    const isKnownLowercaseOrganization =
      this.looksLikeKnownLowercaseOrganization(normalizedLine);
    const isLowerCamelOrganization =
      this.looksLikeLowerCamelOrganization(normalizedLine);
    const isLongAcademicOrganization =
      this.looksLikeLongAcademicOrganizationHeaderText(normalizedLine);
    const isWrappedOrganization =
      this.looksLikeWrappedOrganizationHeaderText(normalizedLine);

    if (
      normalizedLine.length < 2 ||
      (normalizedLine.length > 90 &&
        !isLongAcademicOrganization &&
        !isWrappedOrganization) ||
      /^[-+*•]/u.test(normalizedLine) ||
      (/[.?]$/.test(normalizedLine) &&
        !/\b(?:co|corp|gmbh|inc|llc|ltd)\.$/i.test(normalizedLine)) ||
      (/^[a-z]/u.test(normalizedLine) &&
        !isKnownLowercaseOrganization &&
        !isLowerCamelOrganization) ||
      normalizedLine.includes('@') ||
      /https?:\/\//iu.test(normalizedLine) ||
      this.looksLikeDuration(normalizedLine) ||
      (this.looksLikePosition(normalizedLine) &&
        !this.hasExplicitOrganizationCueText(normalizedLine)) ||
      this.looksLikeMediaDescriptionLine(normalizedLine) ||
      this.looksLikeSentenceLikeDescriptionText(normalizedLine) ||
      isSectionHeaderText(normalizedLine)
    ) {
      return false;
    }

    return (
      !this.looksLikeLocation(normalizedLine) ||
      this.hasExplicitOrganizationCueText(normalizedLine)
    );
  }

  private static looksLikeCanonicalHeaderTitleLine(
    line: NormalizedParserLine,
    allLines: string[]
  ): boolean {
    const normalizedLine = line.text.trim();

    return (
      !this.looksLikeOrganizationBoundaryCandidate(
        normalizedLine,
        line.index,
        allLines
      ) &&
      (this.looksLikePosition(normalizedLine) ||
        this.looksLikePotentialPositionTitleLine(normalizedLine))
    );
  }

  private static canonicalHeaderLocationLine({
    durationLine,
    parserLines,
  }: {
    durationLine: NormalizedParserLine;
    parserLines: NormalizedParserLine[];
  }): NormalizedParserLine | undefined {
    const possibleLocationLine = this.nextContentLine(
      parserLines,
      durationLine.index + 1
    );

    if (!possibleLocationLine) {
      return undefined;
    }

    const text = possibleLocationLine.text;
    const lineTexts = parserLines.map(line => line.text);

    if (
      this.canStartCanonicalExperienceHeader(text) &&
      (this.hasImmediateTitleAndDurationAfterOrganization(
        possibleLocationLine.index,
        lineTexts
      ) ||
        this.hasTotalDurationThenPosition(
          possibleLocationLine.index,
          lineTexts
        ))
    ) {
      return undefined;
    }

    return this.looksLikeLocation(text) ||
      classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text,
      }).isLocation
      ? possibleLocationLine
      : undefined;
  }

  private static scoreExperienceHeaderCandidate(
    candidate: ExperienceHeaderCandidate,
    parserLines: NormalizedParserLine[]
  ): number {
    const organizationText = candidate.organizationLine.text.trim();
    let score = 4;

    if (this.hasAlignedHeaderGeometry(candidate)) {
      score += 2;
    }

    if (this.hasProminentOrganizationFont(candidate)) {
      score += 1;
    }

    if (this.hasOrganizationHeaderShape(organizationText)) {
      score += 1;
    }

    if (this.descriptionMentionsOrganization(candidate, parserLines)) {
      score += 1;
    }

    if (
      looksLikePersonNameText(organizationText) &&
      !this.hasExplicitOrganizationCueText(organizationText)
    ) {
      score -= 3;
    }

    return score;
  }

  private static hasAlignedHeaderGeometry(
    candidate: ExperienceHeaderCandidate
  ): boolean {
    const headerLines = this.headerGeometryLines(candidate);
    const organizationX = candidate.organizationLine.x;
    const hasAlignedX =
      organizationX !== undefined &&
      headerLines.every(
        line =>
          line.x !== undefined &&
          Math.abs(line.x - organizationX) <=
            this.EXPERIENCE_HEADER_ALIGNMENT_TOLERANCE
      );
    const knownColumns = headerLines
      .map(line => line.column)
      .filter(column => column !== undefined);
    const firstColumn = knownColumns[0];
    const hasSameColumn =
      firstColumn === undefined ||
      knownColumns.every(column => column === firstColumn);

    return hasAlignedX && hasSameColumn;
  }

  private static hasProminentOrganizationFont(
    candidate: ExperienceHeaderCandidate
  ): boolean {
    const organizationFontSize = candidate.organizationLine.fontSize;

    if (organizationFontSize === undefined) {
      return false;
    }

    return this.headerGeometryLines(candidate)
      .filter(line => line !== candidate.organizationLine)
      .every(
        line =>
          line.fontSize !== undefined && organizationFontSize >= line.fontSize
      );
  }

  private static headerGeometryLines(
    candidate: ExperienceHeaderCandidate
  ): NormalizedParserLine[] {
    return [
      candidate.organizationLine,
      ...(candidate.totalDurationLine ? [candidate.totalDurationLine] : []),
      candidate.titleLine,
      candidate.durationLine,
    ];
  }

  private static hasOrganizationHeaderShape(text: string): boolean {
    return (
      this.hasExplicitOrganizationCueText(text) ||
      this.looksLikeVisualOrganizationHeaderText(text)
    );
  }

  private static hasExplicitOrganizationCueText(text: string): boolean {
    const normalizedLine = text.trim();

    return (
      this.looksLikeKnownLowercaseOrganization(normalizedLine) ||
      /\bMarine Corps\b/u.test(normalizedLine) ||
      this.looksLikeLowerCamelOrganization(normalizedLine) ||
      this.looksLikeLongAcademicOrganizationHeaderText(normalizedLine) ||
      this.looksLikeWrappedOrganizationHeaderText(normalizedLine) ||
      this.hasOrganizationDomainCueText(normalizedLine) ||
      this.hasOrganizationSuffixText(normalizedLine) ||
      looksLikeOrganizationNameText(normalizedLine) ||
      /\bthan\b/iu.test(normalizedLine) ||
      /[&|–-]/u.test(normalizedLine) ||
      /\b[A-Z]{2,}\b/u.test(normalizedLine)
    );
  }

  private static descriptionMentionsOrganization(
    candidate: ExperienceHeaderCandidate,
    parserLines: NormalizedParserLine[]
  ): boolean {
    const organizationLookupText = this.normalizeHeaderLookupText(
      candidate.organizationLine.text
    );

    if (organizationLookupText.length < 4) {
      return false;
    }

    let checkedLineCount = 0;
    let nextLine = this.nextContentLine(
      parserLines,
      (candidate.locationLine ?? candidate.durationLine).index + 1
    );

    while (
      nextLine &&
      checkedLineCount < this.EXPERIENCE_HEADER_DESCRIPTION_LOOKAHEAD
    ) {
      const text = nextLine.text;

      if (
        this.looksLikeDuration(text) ||
        isSectionHeaderText(text) ||
        this.isExperienceNoiseLine(text)
      ) {
        break;
      }

      if (
        this.normalizeHeaderLookupText(text).includes(organizationLookupText)
      ) {
        return true;
      }

      checkedLineCount++;
      nextLine = this.nextContentLine(parserLines, nextLine.index + 1);
    }

    return false;
  }

  private static normalizeHeaderLookupText(text: string): string {
    return text
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private static splitCombinedOrganizationTitleLine({
    line,
    nextLine,
  }: CombinedOrganizationTitleLineParams):
    | CombinedOrganizationTitleLine
    | undefined {
    if (!nextLine || !this.looksLikeDuration(nextLine)) {
      return undefined;
    }

    const normalizedLine = line.trim();
    const match = normalizedLine.match(
      this.COMBINED_ORGANIZATION_TITLE_LINE_PATTERN
    );

    if (!match) {
      return undefined;
    }

    const organization = match[1].trim();
    const title = match[2].trim();

    if (
      !this.looksLikeVisualOrganizationHeaderText(organization) ||
      this.looksLikeOrganizationSuffixText(title) ||
      looksLikeOrganizationNameText(title) ||
      (!this.looksLikePosition(title) &&
        !this.looksLikePotentialPositionTitleLine(title))
    ) {
      return undefined;
    }

    return {
      organization,
      title,
    };
  }

  private static looksLikeOrganizationSuffixText(text: string): boolean {
    return this.ORGANIZATION_SUFFIX_TITLE_FRAGMENT_PATTERN.test(text.trim());
  }

  private static hasOrganizationSuffixText(text: string): boolean {
    return text
      .split(/\s+/)
      .some(word =>
        this.looksLikeOrganizationSuffixText(word.replace(/^[,]+|[,]+$/g, ''))
      );
  }

  private static hasOrganizationDomainCueText(text: string): boolean {
    return /\b(?:AI|Coalition|Connections|Federation|Forex|Labs?|Network|Robotics|Services?|Ventures?)\b/u.test(
      text
    );
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
    if (
      lowerLine === 'experience' ||
      lowerLine === 'experiência' ||
      this.isExperienceNoiseLine(text)
    ) {
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

        if (
          this.looksLikePosition(text) ||
          this.looksLikeLoosePositionTitle(text, index, lineTexts)
        ) {
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
        if (this.looksLikeOrganizationBeforePosition(text, index, lineTexts)) {
          return 'organization';
        }

        if (this.looksLikeDuration(text)) {
          return 'duration';
        }

        if (
          this.looksLikeLocation(text) ||
          this.looksLikeStandaloneLocationAfterDuration(text, index, lineTexts)
        ) {
          return 'location';
        }

        if (this.looksLikeWrappedTitleContinuation(text, index, lineTexts)) {
          return 'description';
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

        if (this.looksLikeOrganizationBeforePosition(text, index, lineTexts)) {
          return 'organization';
        }

        if (
          this.looksLikeOrganization(
            text,
            line.fontSize ?? 0,
            index,
            lineTexts,
            { allowPersonLikeName: true }
          ) &&
          this.hasImmediateTitleAndDurationAfterOrganization(index, lineTexts)
        ) {
          return 'organization';
        }

        if (this.looksLikeDuration(text)) {
          return 'duration';
        }

        if (
          this.looksLikeLocation(text) ||
          this.looksLikeStandaloneLocationAfterDuration(text, index, lineTexts)
        ) {
          return 'location';
        }

        if (
          (this.looksLikePosition(text) ||
            this.looksLikeLoosePositionTitle(text, index, lineTexts)) &&
          this.hasOwnDurationBeforeBoundary(index, lineTexts)
        ) {
          return 'position';
        }

        if (
          this.looksLikeSentenceEndingDescriptionContinuationLine(
            text,
            lineTexts[index - 1] ?? undefined
          )
        ) {
          return 'description';
        }

        if (
          this.looksLikeDescriptionLine({
            allLines: lineTexts,
            index,
            line: text,
            previousLine: lineTexts[index - 1],
          }) &&
          (!this.hasOwnDurationBeforeBoundary(index, lineTexts) ||
            text.length > this.MIN_DESCRIPTION_LINE_LENGTH)
        ) {
          return 'description';
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

        if (
          this.looksLikeDescriptionContinuationLine(
            text,
            lineTexts[index - 1] ?? undefined
          )
        ) {
          return 'description';
        }

        if (
          this.looksLikeDescriptionLine({
            allLines: lineTexts,
            index,
            line: text,
            previousLine: lineTexts[index - 1],
          })
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
    const isKnownLowercaseOrganization = /^(?:self-employed)$/i.test(
      normalizedLine
    );
    const isLowerCamelOrganization =
      this.looksLikeLowerCamelOrganization(normalizedLine);
    const isLongAcademicOrganization =
      this.looksLikeLongAcademicOrganizationHeaderText(normalizedLine);
    const isWrappedOrganization =
      this.looksLikeWrappedOrganizationHeaderText(normalizedLine);
    const hasJobDetailsAfter =
      this.hasJobDetailsAfterOrganization(index, allLines) ||
      this.hasImmediateTitleAndDurationAfterOrganization(index, allLines, 4) ||
      this.hasTotalDurationThenPosition(index, allLines, 5);
    const hasVisualOrganizationCue =
      isKnownLowercaseOrganization ||
      isLowerCamelOrganization ||
      isLongAcademicOrganization ||
      isWrappedOrganization ||
      this.hasOrganizationDomainCueText(normalizedLine) ||
      this.hasOrganizationSuffixText(normalizedLine) ||
      /\bthan\b/i.test(normalizedLine) ||
      /[&|–-]/u.test(normalizedLine) ||
      /\b[A-Z]{2,}\b/.test(normalizedLine);

    if (
      (normalizedLine.length > 80 &&
        !isLongAcademicOrganization &&
        !isWrappedOrganization) ||
      /^[-+*•]/u.test(normalizedLine) ||
      (/[.?]$/.test(normalizedLine) &&
        !/\b(?:co|corp|gmbh|inc|llc|ltd)\.$/i.test(normalizedLine)) ||
      (/^[a-z]/.test(normalizedLine) &&
        !isKnownLowercaseOrganization &&
        !isLowerCamelOrganization) ||
      this.looksLikeDuration(normalizedLine) ||
      (!hasJobDetailsAfter && this.looksLikeLocation(normalizedLine)) ||
      this.looksLikePosition(normalizedLine) ||
      this.looksLikeMediaDescriptionLine(normalizedLine) ||
      this.looksLikeSentenceLikeDescriptionText(normalizedLine) ||
      isSectionHeaderText(normalizedLine) ||
      (!options.allowPersonLikeName &&
        !hasVisualOrganizationCue &&
        looksLikePersonNameText(normalizedLine))
    ) {
      return false;
    }

    const hasOrganizationShape =
      looksLikeOrganizationNameText(normalizedLine) ||
      isKnownLowercaseOrganization ||
      isLowerCamelOrganization ||
      isLongAcademicOrganization ||
      isWrappedOrganization ||
      ((options.allowPersonLikeName || hasVisualOrganizationCue) &&
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
      this.looksLikeMediaDescriptionLine(normalizedLine) ||
      isSectionHeaderText(normalizedLine)
    ) {
      return false;
    }

    const words = normalizedLine.split(/\s+/).filter(Boolean);

    return (
      words.length > 0 &&
      words.length <= 8 &&
      words.every(
        word =>
          this.ORGANIZATION_CONNECTOR_WORD_PATTERN.test(word) ||
          this.looksLikeOrganizationSuffixText(word) ||
          /^&$/u.test(word) ||
          /^[-–]$/u.test(word) ||
          /^\([\p{Lu}0-9&.'+!–-]+\)$/u.test(word) ||
          /^\([a-z0-9.-]+\.[a-z0-9.-]+\)$/iu.test(word) ||
          /^[\p{Lu}0-9][\p{L}\p{M}0-9&.'+!–-]*$/u.test(word)
      )
    );
  }

  private static looksLikeWrappedOrganizationHeaderText(line: string): boolean {
    const normalizedLine = line.trim();
    const hasPipeSeparator = normalizedLine.includes('|');

    if (
      normalizedLine.length < 12 ||
      normalizedLine.length > 140 ||
      normalizedLine.includes('@') ||
      normalizedLine.includes('•') ||
      /https?:\/\//i.test(normalizedLine) ||
      /^page\s+\d+\s+of\s+\d+$/i.test(normalizedLine) ||
      this.looksLikeDuration(normalizedLine) ||
      this.looksLikeLocation(normalizedLine) ||
      this.looksLikePosition(normalizedLine) ||
      this.looksLikeMediaDescriptionLine(normalizedLine) ||
      this.looksLikeSentenceLikeDescriptionText(normalizedLine) ||
      isSectionHeaderText(normalizedLine)
    ) {
      return false;
    }

    const words = normalizedLine.split(/\s+/).filter(Boolean);
    const hasOrganizationCue =
      hasPipeSeparator || this.hasOrganizationSuffixText(normalizedLine);

    return (
      hasOrganizationCue &&
      words.length >= 3 &&
      words.length <= 18 &&
      words.every(
        word =>
          this.ORGANIZATION_CONNECTOR_WORD_PATTERN.test(word) ||
          this.looksLikeOrganizationSuffixText(word) ||
          /^&$/u.test(word) ||
          /^\|$/u.test(word) ||
          /^[-–]$/u.test(word) ||
          /^\([\p{L}\p{M}0-9&.'+!–-]+\)$/u.test(word) ||
          /^[\p{Lu}0-9][\p{L}\p{M}0-9&.'+!–-]*$/u.test(word) ||
          (hasPipeSeparator && /^[\p{Ll}\p{M}]+$/u.test(word))
      )
    );
  }

  private static looksLikeLongAcademicOrganizationHeaderText(
    line: string
  ): boolean {
    const normalizedLine = line.trim();

    if (
      normalizedLine.length < 12 ||
      normalizedLine.length > 120 ||
      normalizedLine.includes('@') ||
      normalizedLine.includes('•') ||
      /https?:\/\//i.test(normalizedLine) ||
      /^page\s+\d+\s+of\s+\d+$/i.test(normalizedLine) ||
      this.looksLikeDuration(normalizedLine) ||
      this.looksLikeLocation(normalizedLine) ||
      this.looksLikePosition(normalizedLine) ||
      this.looksLikeMediaDescriptionLine(normalizedLine) ||
      isSectionHeaderText(normalizedLine)
    ) {
      return false;
    }

    const words = normalizedLine.split(/\s+/).filter(Boolean);
    const hasAcademicOrganizationWord = words.some(word =>
      /^(?:college|laboratory|lab|school|sciences?|university|institute)$/iu.test(
        word.replace(/[(),.]+/g, '')
      )
    );

    return (
      hasAcademicOrganizationWord &&
      words.length >= 3 &&
      words.length <= 14 &&
      words.every(
        word =>
          this.ORGANIZATION_CONNECTOR_WORD_PATTERN.test(word) ||
          /^\([\p{L}\p{M}0-9&.'+!–-]+\)$/u.test(word) ||
          /^[\p{Lu}0-9][\p{L}\p{M}0-9&.'+!–-]*$/u.test(word)
      )
    );
  }

  private static looksLikePosition(line: string): boolean {
    const normalizedLine = line.trim();

    if (/^venture$/iu.test(normalizedLine)) {
      // Real profiles use standalone "Venture" as a role; it is too broad for POSITION_KEYWORDS.
      return true;
    }

    return (
      !/^[-+*•]/u.test(normalizedLine) &&
      looksLikePositionTitleText(normalizedLine) &&
      !this.looksLikeDuration(normalizedLine) &&
      !this.looksLikeLocation(normalizedLine)
    );
  }

  private static looksLikeKnownLowercaseOrganization(line: string): boolean {
    return /^(?:self-employed)$/i.test(line.trim());
  }

  private static looksLikeLowerCamelOrganization(line: string): boolean {
    return (
      /^[a-z][\p{Lu}][\p{L}\p{M}0-9&.'+-]*/u.test(line) &&
      /\b(?:Inc|LLC|Ltd|Solutions|Systems|Technologies)\b/iu.test(line)
    );
  }

  private static looksLikeOrganizationBeforePosition(
    line: string,
    index: number,
    allLines: string[]
  ): boolean {
    const normalizedLine = line.trim();
    const isLongAcademicOrganization =
      this.looksLikeLongAcademicOrganizationHeaderText(normalizedLine);
    const hasFollowingPosition =
      this.hasImmediateTitleAndDurationAfterOrganization(index, allLines) ||
      this.hasTotalDurationThenPosition(index, allLines);
    const hasLocationShape = this.looksLikeLocation(normalizedLine);
    const hasNonLocationOrganizationNameShape =
      !hasLocationShape && looksLikeOrganizationNameText(normalizedLine);
    const hasOrganizationCue =
      isLongAcademicOrganization ||
      this.looksLikeLowerCamelOrganization(normalizedLine) ||
      this.hasOrganizationDomainCueText(normalizedLine) ||
      this.hasOrganizationSuffixText(normalizedLine) ||
      hasNonLocationOrganizationNameShape ||
      this.looksLikeWrappedOrganizationHeaderText(normalizedLine);

    if (
      normalizedLine.length < 2 ||
      (normalizedLine.length > 90 && !isLongAcademicOrganization) ||
      (/^[a-z]/.test(normalizedLine) &&
        !this.looksLikeLowerCamelOrganization(normalizedLine)) ||
      /[.!?]$/.test(normalizedLine) ||
      normalizedLine.includes('@') ||
      /^[-+*•]/u.test(normalizedLine) ||
      isSectionHeaderText(normalizedLine) ||
      this.looksLikeDuration(normalizedLine) ||
      (hasLocationShape && (!hasFollowingPosition || !hasOrganizationCue)) ||
      this.looksLikeMediaDescriptionLine(normalizedLine) ||
      this.looksLikeSentenceLikeDescriptionText(normalizedLine)
    ) {
      return false;
    }

    return hasFollowingPosition;
  }

  private static looksLikeLoosePositionTitle(
    line: string,
    index: number,
    allLines: string[]
  ): boolean {
    const normalizedLine = line.trim();

    if (!this.hasOwnDurationBeforeBoundary(index, allLines)) {
      return false;
    }

    return (
      !this.hasImmediateTitleAndDurationAfterOrganization(index, allLines) &&
      this.looksLikePotentialPositionTitleLine(normalizedLine) &&
      !looksLikeOrganizationNameText(normalizedLine)
    );
  }

  private static hasImmediateTitleAndDurationAfterOrganization(
    index: number,
    allLines: string[],
    maxLookahead = 3
  ): boolean {
    let possibleTitleIndex = index + 1;

    while (
      possibleTitleIndex < allLines.length &&
      possibleTitleIndex <= index + maxLookahead &&
      this.isExperienceNoiseLine(allLines[possibleTitleIndex])
    ) {
      possibleTitleIndex++;
    }

    const possibleTitle = allLines[possibleTitleIndex];

    if (
      !possibleTitle ||
      this.looksLikeOrganizationBoundaryCandidate(
        possibleTitle,
        possibleTitleIndex,
        allLines
      ) ||
      (!this.looksLikePosition(possibleTitle) &&
        !this.looksLikePotentialPositionTitleLine(possibleTitle))
    ) {
      return false;
    }

    return allLines
      .slice(possibleTitleIndex + 1, index + 1 + maxLookahead)
      .some(nextLine => this.looksLikeDuration(nextLine));
  }

  private static hasJobDetailsAfterOrganization(
    index: number,
    allLines: string[],
    maxLookahead = 4
  ): boolean {
    for (
      let nextIndex = index + 1;
      nextIndex < allLines.length && nextIndex <= index + maxLookahead;
      nextIndex++
    ) {
      const nextLine = allLines[nextIndex];

      if (this.isExperienceNoiseLine(nextLine)) {
        continue;
      }

      if (
        this.looksLikeOrganizationBoundaryCandidate(
          nextLine,
          nextIndex,
          allLines
        )
      ) {
        return false;
      }

      if (
        this.looksLikeDuration(nextLine) ||
        this.looksLikePosition(nextLine)
      ) {
        return true;
      }

      if (!this.looksLikeLocation(nextLine)) {
        return false;
      }
    }

    return false;
  }

  private static hasTotalDurationThenPosition(
    index: number,
    allLines: string[],
    maxLookahead = 4
  ): boolean {
    const nextLines = allLines.slice(index + 1, index + 1 + maxLookahead);

    if (!nextLines[0] || !this.looksLikeTotalDuration(nextLines[0])) {
      return false;
    }

    const linesAfterTotalDuration = nextLines.slice(1);
    const durationIndex = linesAfterTotalDuration.findIndex(nextLine =>
      this.looksLikeDuration(nextLine)
    );

    if (durationIndex === -1) {
      return false;
    }

    return linesAfterTotalDuration
      .slice(0, durationIndex)
      .some(nextLine => this.looksLikePosition(nextLine));
  }

  private static hasOwnDurationBeforeBoundary(
    index: number,
    allLines: string[],
    maxLookahead = 3
  ): boolean {
    for (
      let nextIndex = index + 1;
      nextIndex < allLines.length && nextIndex <= index + maxLookahead;
      nextIndex++
    ) {
      const nextLine = allLines[nextIndex];

      if (this.isExperienceNoiseLine(nextLine)) {
        continue;
      }

      if (
        this.looksLikeOrganizationBoundaryCandidate(
          nextLine,
          nextIndex,
          allLines
        )
      ) {
        return false;
      }

      if (this.looksLikeDuration(nextLine)) {
        return true;
      }

      if (!this.looksLikeLocation(nextLine)) {
        return false;
      }
    }

    return false;
  }

  private static looksLikeOrganizationBoundaryCandidate(
    line: string,
    index: number,
    allLines: string[]
  ): boolean {
    const normalizedLine = line.trim();
    const isKnownLowercaseOrganization = /^self-employed$/i.test(
      normalizedLine
    );
    const isLowerCamelOrganization =
      this.looksLikeLowerCamelOrganization(normalizedLine);
    const isLongAcademicOrganization =
      this.looksLikeLongAcademicOrganizationHeaderText(normalizedLine);

    if (
      normalizedLine.length < 2 ||
      (normalizedLine.length > 90 && !isLongAcademicOrganization) ||
      (/^[a-z]/.test(normalizedLine) &&
        !isKnownLowercaseOrganization &&
        !isLowerCamelOrganization) ||
      (/[.!?]$/.test(normalizedLine) &&
        !/\b(?:co|corp|gmbh|inc|llc|ltd)\.$/i.test(normalizedLine)) ||
      normalizedLine.includes('@') ||
      /^[-+*•]/u.test(normalizedLine) ||
      isSectionHeaderText(normalizedLine) ||
      this.looksLikeDuration(normalizedLine) ||
      this.looksLikeLocation(normalizedLine) ||
      this.looksLikePosition(normalizedLine) ||
      this.looksLikeMediaDescriptionLine(normalizedLine) ||
      this.looksLikeSentenceLikeDescriptionText(normalizedLine)
    ) {
      return false;
    }

    const hasOrganizationShape =
      looksLikeOrganizationNameText(normalizedLine) ||
      isKnownLowercaseOrganization ||
      isLowerCamelOrganization ||
      isLongAcademicOrganization ||
      this.looksLikeVisualOrganizationHeaderText(normalizedLine);

    return (
      hasOrganizationShape &&
      (this.hasImmediateTitleAndDurationAfterOrganization(index, allLines) ||
        this.hasTotalDurationThenPosition(index, allLines))
    );
  }

  private static looksLikePotentialPositionTitleLine(line: string): boolean {
    const normalizedLine = line.trim();

    return (
      normalizedLine.length >= 3 &&
      normalizedLine.length < 90 &&
      normalizedLine.split(/\s+/).length <= 10 &&
      /^[\p{Lu}0-9]/u.test(normalizedLine) &&
      !/[.!?]$/.test(normalizedLine) &&
      !normalizedLine.includes('@') &&
      !/https?:\/\//i.test(normalizedLine) &&
      !this.isExperienceNoiseLine(normalizedLine) &&
      !this.looksLikeDuration(normalizedLine) &&
      !this.looksLikeLocation(normalizedLine) &&
      !this.looksLikeMediaDescriptionLine(normalizedLine) &&
      !isSectionHeaderText(normalizedLine)
    );
  }

  private static looksLikeWrappedTitleContinuation(
    line: string,
    index: number,
    allLines: string[]
  ): boolean {
    const nextLines = allLines.slice(index + 1, index + 4);
    const durationIndex = nextLines.findIndex(nextLine =>
      this.looksLikeDuration(nextLine)
    );

    if (durationIndex === -1) {
      return false;
    }

    const linesBeforeDuration = nextLines.slice(0, durationIndex);

    return (
      !linesBeforeDuration.some(nextLine => this.looksLikePosition(nextLine)) &&
      this.looksLikePendingTitleContinuationLine(line)
    );
  }

  private static looksLikeDuration(line: string): boolean {
    const normalizedLine = this.normalizeDurationLineText(line);

    if (/^[+*•]/u.test(normalizedLine)) {
      return false;
    }

    return (
      this.looksLikeWholeLineDateRangeText(normalizedLine) ||
      this.looksLikeTotalDurationText(normalizedLine)
    );
  }

  private static looksLikeTotalDuration(line: string): boolean {
    return this.looksLikeTotalDurationText(line);
  }

  private static looksLikeWholeLineDateRangeText(line: string): boolean {
    const normalizedLine = this.normalizeDurationLineText(line);
    const dateRangeText = extractProfileDateRangeText(normalizedLine);

    if (!dateRangeText || !looksLikeDateRangeText(normalizedLine)) {
      return false;
    }

    const lineDatePortion = this.stripDurationSuffixText(normalizedLine);

    return (
      this.normalizeDurationLineText(dateRangeText) ===
      this.normalizeDurationLineText(lineDatePortion)
    );
  }

  private static looksLikeTotalDurationText(line: string): boolean {
    return this.TOTAL_DURATION_LINE_PATTERN.test(
      this.normalizeDurationLineText(line)
    );
  }

  private static normalizeDurationLineText(text: string): string {
    return text
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static stripDurationSuffixText(text: string): string {
    return this.normalizeDurationLineText(text)
      .replace(/\s*[·|]\s*.*$/u, '')
      .replace(
        new RegExp(
          `\\s*\\([^)]*(?:less\\s+than\\s+a\\s+year|${this.DURATION_WORD_PATTERN.source})[^)]*\\)\\s*$`,
          'iu'
        ),
        ''
      )
      .trim();
  }

  private static isExperienceNoiseLine(line: string): boolean {
    return /^page\s+\d+\s+of\s+\d+$/i.test(line.trim());
  }

  private static looksLikeDescriptionLine({
    allLines,
    index,
    line,
    previousLine,
  }: DescriptionLineParams): boolean {
    const normalizedLine = line.trim();
    const normalizedPreviousLine = previousLine?.trim();

    // Longer lines are usually prose, while short lines need continuation cues.
    if (normalizedLine.length > this.MIN_DESCRIPTION_LINE_LENGTH) {
      return true;
    }

    if (this.looksLikeMediaDescriptionLine(normalizedLine)) {
      return true;
    }

    if (
      normalizedPreviousLine &&
      this.looksLikeShortDescriptorLine(normalizedLine) &&
      !this.looksLikeShortDescriptorEntryHeader(normalizedLine, index, allLines)
    ) {
      return true;
    }

    // Stock ticker fragments often appear in description text for public companies.
    if (/\$[A-Z]{1,8}\b/.test(normalizedLine)) {
      return true;
    }

    if (/^[-+*•]\s*\S/u.test(normalizedLine)) {
      return true;
    }

    if (
      /^[\p{Lu}0-9][\p{L}\p{M}0-9\s&/+.'-]{1,45}:\s*(?:\S.*)?$/u.test(
        normalizedLine
      )
    ) {
      return true;
    }

    if (!normalizedPreviousLine) {
      return false;
    }

    if (
      this.looksLikeShortDescriptorEntryHeader(normalizedLine, index, allLines)
    ) {
      return false;
    }

    // Short continuations rely on syntax: lowercase starts, sentence endings, or
    // previous-line connector words that imply the sentence is not finished.
    return (
      /^[a-z]/.test(normalizedLine) ||
      /[.!?]$/.test(normalizedLine) ||
      this.DESCRIPTION_CONTINUATION_CONNECTOR_PATTERN.test(
        normalizedPreviousLine
      )
    );
  }

  private static looksLikeSentenceEndingDescriptionContinuationLine(
    line: string,
    previousLine?: string
  ): boolean {
    const normalizedLine = line.trim();
    const normalizedPreviousLine = previousLine?.trim();

    if (
      !normalizedPreviousLine ||
      normalizedPreviousLine.length <
        this.MIN_DESCRIPTION_CONTINUATION_CONTEXT_LENGTH ||
      !/[.!?]$/.test(normalizedLine)
    ) {
      return false;
    }

    if (
      /[.!?]$/.test(normalizedPreviousLine) &&
      this.looksLikePosition(normalizedLine)
    ) {
      return false;
    }

    return (
      !this.looksLikeDuration(normalizedLine) &&
      !this.looksLikeLocation(normalizedLine) &&
      !looksLikeOrganizationNameText(normalizedLine) &&
      !this.looksLikeVisualOrganizationHeaderText(normalizedLine)
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
      this.DESCRIPTION_CONTINUATION_CONNECTOR_PATTERN.test(
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
      this.looksLikeMediaDescriptionLine(normalizedLine) ||
      (/[.!?]$/.test(normalizedLine) &&
        !this.looksLikeDuration(normalizedLine) &&
        !this.looksLikeLocation(normalizedLine) &&
        !this.looksLikePosition(normalizedLine) &&
        !looksLikeOrganizationNameText(normalizedLine) &&
        !this.looksLikeVisualOrganizationHeaderText(normalizedLine))
    );
  }

  private static looksLikeLocation(line: string): boolean {
    const normalizedLine = this.normalizeCompletedLocationText(line);
    const isAddressLocation = this.looksLikeAddressLocationText(normalizedLine);

    if (
      /^[a-z]/.test(normalizedLine) &&
      !isLikelyLocationText(normalizedLine)
    ) {
      return false;
    }

    if (
      !isAddressLocation &&
      this.looksLikeCommaSeparatedProseText(normalizedLine)
    ) {
      return false;
    }

    if (this.looksLikeCommaSeparatedOrganizationName(normalizedLine)) {
      return false;
    }

    const locationClassification = classifyLocationText({
      text: normalizedLine,
    });
    const hasLocationShape =
      isAddressLocation || locationClassification.isLocation;

    return (
      normalizedLine.length < 120 &&
      !looksLikePositionTitleText(normalizedLine) &&
      hasLocationShape &&
      !this.looksLikeDuration(normalizedLine)
    );
  }

  private static looksLikeAddressLocationText(line: string): boolean {
    return /^(?:Rua|R\.|Av\.?|Avenida|Alameda|Praça|Street|St\.|Avenue|Ave\.|Road|Rd\.)(?!\w)/iu.test(
      line
    );
  }

  private static looksLikeCommaSeparatedProseText(line: string): boolean {
    const parts = line
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);

    if (parts.length < 2) {
      return false;
    }

    return parts.some(part => {
      const words = part.split(/\s+/).filter(Boolean);

      return (
        words.length > 4 ||
        words.some(word => this.looksLikeNonLocationLowercaseWord(word))
      );
    });
  }

  private static looksLikeNonLocationLowercaseWord(word: string): boolean {
    const normalizedWord = word.replace(/^[("']+|[)"'.]+$/g, '');

    return (
      /^[\p{Ll}]/u.test(normalizedWord) &&
      !/^(?:al|and|da|das|de|del|der|di|do|dos|du|el|for|la|of|the|van|von)$/iu.test(
        normalizedWord
      )
    );
  }

  private static looksLikeStandaloneLocationAfterDuration(
    line: string,
    index: number,
    allLines: string[]
  ): boolean {
    const previousLine = allLines[index - 1];

    return (
      previousLine !== undefined &&
      this.looksLikeDuration(previousLine) &&
      classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text: line,
      }).isLocation
    );
  }

  private static normalizeLocationText(text: string): string {
    return text
      .replace(/\bY\s+ork\b/g, 'York')
      .replace(
        /\b((?:Greater\s+)?[\p{L}\p{M}.'-]+(?:\s+[\p{L}\p{M}.'-]+){0,5}\s+(?:Area|Metro(?:politan)?\s+Area))[,\s]*(?:U\.?\s*S\.?(?:\.?A\.?)?|USA\.?)[,\s]*$/iu,
        '$1'
      )
      .replace(/,\s*([A-Z])\s+([A-Z])$/g, ', $1$2')
      .replace(/\s+,/g, ',')
      .replace(/,\s*/g, ', ')
      .trim();
  }

  private static normalizeCompletedLocationText(text: string): string {
    return this.normalizeLocationText(text)
      .replace(/,+\s*$/u, '')
      .trim();
  }

  /**
   * Detects comma-separated organization suffixes such as "Company, Inc" while
   * preserving locations like "Los Angeles, California" and "Denver, CO".
   * Parts are normalized by trimming whitespace and trailing dots first.
   */
  private static looksLikeCommaSeparatedOrganizationName(
    line: string
  ): boolean {
    const parts = line
      .split(',')
      .map(part => part.trim().replace(/[.]+$/, '').toLowerCase())
      .filter(Boolean);

    return (
      parts.length >= 2 &&
      parts
        .slice(1)
        .some(part => this.COMMA_SEPARATED_ORGANIZATION_SUFFIXES.has(part))
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
            if (
              currentPosition?.title &&
              !currentPosition.duration &&
              descriptionLines.length === 0 &&
              this.areEquivalentPositionTitles(
                currentPosition.title,
                section.text
              )
            ) {
              currentPosition.title = section.text;
              break;
            }

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
          const dates = parseProfileDateRange(section.text);
          if (currentPosition) {
            if (this.hasPendingTitleContinuation(descriptionLines)) {
              currentPosition.title =
                `${currentPosition.title} ${descriptionLines.join(' ')}`.replace(
                  /\s+/g,
                  ' '
                );
              descriptionLines = [];
            }
            currentPosition.duration = cleanDuration;
            currentPosition.dates = dates;
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
    const positions = completedPosition
      ? [...(workExperience.positions ?? []), completedPosition]
      : (workExperience.positions ?? []);

    if (positions.length === 0) {
      return undefined;
    }

    return {
      organization: workExperience.organization,
      totalDuration: workExperience.totalDuration,
      positions,
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

    const dates =
      position.dates ??
      (position.duration
        ? parseProfileDateRange(position.duration)
        : undefined);

    return {
      ...(dates ? { dates } : {}),
      title: position.title,
      duration: position.duration ?? '',
      ...(position.location
        ? { location: this.normalizeCompletedLocationText(position.location) }
        : {}),
      description: descriptionLines.join(' ').trim(),
    };
  }

  private static hasPendingTitleContinuation(lines: string[]): boolean {
    return (
      lines.length > 0 &&
      lines.every(line => this.looksLikePendingTitleContinuationLine(line))
    );
  }

  private static areEquivalentPositionTitles(
    currentTitle: string,
    nextTitle: string
  ): boolean {
    return (
      currentTitle.localeCompare(nextTitle, undefined, {
        sensitivity: 'base',
      }) === 0
    );
  }

  private static looksLikePendingTitleContinuationLine(line: string): boolean {
    const normalizedLine = line.trim();

    return (
      normalizedLine.length > 1 &&
      normalizedLine.length <= 40 &&
      normalizedLine.split(/\s+/).length <= 4 &&
      /^[\p{Lu}0-9]/u.test(normalizedLine) &&
      !/[.!?]$/.test(normalizedLine) &&
      !/^[-+*•]/u.test(normalizedLine) &&
      !looksLikePositionTitleText(normalizedLine) &&
      !this.looksLikeDuration(normalizedLine) &&
      !this.looksLikeLocation(normalizedLine) &&
      !isSectionHeaderText(normalizedLine)
    );
  }

  private static extractCleanOrganizationName(
    text: string
  ): string | undefined {
    if (/^self-employed$/i.test(text.trim())) {
      return text.trim();
    }

    if (/\bMarine Corps\b/u.test(text.trim())) {
      return text.trim();
    }

    if (
      /^[\p{Lu}0-9][\p{L}\p{M}0-9&.'+!–\-\s]+\s+\([A-Za-z0-9.-]+\.[A-Za-z0-9.-]+\)$/u.test(
        text.trim()
      )
    ) {
      return text.trim();
    }

    if (this.looksLikeLowerCamelOrganization(text.trim())) {
      return text.trim();
    }

    if (this.looksLikeLongAcademicOrganizationHeaderText(text.trim())) {
      return text.trim();
    }

    if (this.looksLikeWrappedOrganizationHeaderText(text.trim())) {
      return text.trim();
    }

    const cleanOrganizationName = cleanOrganizationNameText(text);

    if (cleanOrganizationName) {
      return cleanOrganizationName;
    }

    const normalizedText = text
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return this.looksLikeVisualOrganizationHeaderText(normalizedText) ||
      this.looksLikeWrappedOrganizationHeaderText(normalizedText)
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

  private static looksLikeMediaDescriptionLine(line: string): boolean {
    return this.MEDIA_DESCRIPTION_LINE_PATTERN.test(line.trim());
  }

  private static looksLikeSentenceLikeDescriptionText(line: string): boolean {
    const normalizedLine = line.trim();

    return (
      /…/u.test(normalizedLine) ||
      /[.!?]\s+(?:actively|i|our|successfully|the|this|we)\b/iu.test(
        normalizedLine
      )
    );
  }

  private static looksLikeShortDescriptorLine(line: string): boolean {
    const normalizedLine = line.trim();

    return (
      normalizedLine.length >= 2 &&
      normalizedLine.length <= 45 &&
      normalizedLine.split(/\s+/).length <= 5 &&
      /^[\p{Lu}0-9]/u.test(normalizedLine) &&
      !/[.!?]$/.test(normalizedLine) &&
      !normalizedLine.includes('@') &&
      !/https?:\/\//i.test(normalizedLine) &&
      !/^[-+*•]/u.test(normalizedLine) &&
      !this.looksLikeDuration(normalizedLine) &&
      !this.looksLikeLocation(normalizedLine) &&
      !isSectionHeaderText(normalizedLine)
    );
  }

  private static looksLikeShortDescriptorEntryHeader(
    line: string,
    index: number,
    allLines: string[]
  ): boolean {
    const normalizedLine = line.trim();

    if (
      this.looksLikePosition(normalizedLine) ||
      this.looksLikeLoosePositionTitle(normalizedLine, index, allLines)
    ) {
      return true;
    }

    return (
      (looksLikeOrganizationNameText(normalizedLine) ||
        this.looksLikeVisualOrganizationHeaderText(normalizedLine) ||
        this.looksLikeWrappedOrganizationHeaderText(normalizedLine)) &&
      this.looksLikeOrganizationBeforePosition(normalizedLine, index, allLines)
    );
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
