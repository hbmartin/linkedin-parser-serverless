import { normalizeWhitespace } from '../utils/text-utils.js';
import type { StructuralLine } from '../utils/structural-lines.js';
import type {
  Education,
  ParsedSectionResult,
  SectionParseWarning,
} from '../types/profile.js';
import {
  looksLikeDateRangeText,
  parseProfileDateRange,
} from '../utils/date-parser.js';
import { createTextParserLines } from '../utils/parser-lines.js';
import {
  isEducationSectionHeaderText,
  isLikelyLocationText,
  isSectionHeaderText,
} from '../utils/profile-text.js';

type EducationLineState =
  | 'seeking_institution'
  | 'seeking_degree'
  | 'in_details';

interface AppendDegreeTextParams {
  existingDegree: string;
  degreePart: string;
}

interface ShouldAppendStructuralDegreePartParams {
  existingDegree?: string;
  degreePart: string;
  line: string;
  year: string;
}

interface StructuralDegreeContinuationParams {
  existingDegree: string;
  degreePart: string;
}

export class EducationParser {
  private static readonly LOCATION_PATTERN: RegExp =
    /^[\p{Lu}][\p{L}\p{M}\s.-]+(?:,\s*[\p{Lu}][\p{L}\p{M}\s.-]*)*$/u;
  private static readonly STRUCTURAL_DEGREE_BOUNDARY_PATTERN: RegExp =
    /[,/&-]\s*$/u;
  private static readonly STRUCTURAL_DEGREE_COMMA_CONNECTOR_PATTERN: RegExp =
    /,\s*(?:and|for|in|of)\s*$/iu;
  private static readonly STRUCTURAL_DEGREE_WORD_CONNECTOR_PATTERN: RegExp =
    /\b(?:and|for|in|of)\s*$/iu;
  private static readonly STRUCTURAL_ACADEMIC_FRAGMENT_PATTERN: RegExp =
    /\b(?:administration|analytics|arts|baccalaureate|business|communications|data|design|economics|education|engineering|finance|law|management|marketing|mathematics|policy|product|program|science|sciences|software|studies|systems|technician|technology)\b/iu;

  static parse(text: string): Education[] {
    return this.parseWithWarnings(text).value;
  }

  static parseWithWarnings(text: string): ParsedSectionResult<Education[]> {
    const lines = createTextParserLines(text)
      .filter(line => line.section === 'education')
      .map(line => line.text);
    const value = this.parseEducationLines(lines);

    return {
      value,
      warnings: this.createEducationWarnings(value, lines),
    };
  }

  static parseStructural(lines: StructuralLine[]): Education[] {
    return this.parseStructuralWithWarnings(lines).value;
  }

  static parseStructuralWithWarnings(
    lines: StructuralLine[]
  ): ParsedSectionResult<Education[]> {
    const educationLines = this.extractStructuralEducationLines(lines);
    const value = this.parseStructuralEducationLines(educationLines);

    return {
      value,
      warnings: this.createEducationWarnings(
        value,
        educationLines.map(line => line.text)
      ),
    };
  }

  private static parseEducationLines(lines: string[]): Education[] {
    const educations: Education[] = [];
    let currentEducation: Partial<Education> | null = null;
    let state: EducationLineState = 'seeking_institution';

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
        state = 'seeking_degree';
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
        state = 'in_details';
      }
      // Check if this looks like a year
      else if (currentEducation && this.looksLikeYear(normalizedLine)) {
        currentEducation.year = normalizedLine;
        state = 'in_details';
      }
      // Check if this looks like a location
      else if (currentEducation && this.looksLikeLocation(normalizedLine)) {
        currentEducation.location = normalizedLine;
        state = 'in_details';
      }
      // If we don't have an institution yet, maybe this line is it
      else if (!currentEducation || state === 'seeking_institution') {
        currentEducation = {
          institution: normalizedLine,
          degree: '',
          year: '',
          location: '',
        };
        state = 'seeking_degree';
      }
    }

    // Add the last education
    if (currentEducation && currentEducation.institution) {
      educations.push(this.fillDefaults(currentEducation));
    }

    return educations;
  }

  private static parseStructuralEducationLines(
    educationLines: StructuralLine[]
  ): Education[] {
    if (educationLines.length === 0) {
      return [];
    }

    const institutionFontSize = Math.max(
      ...educationLines.map(line => line.fontSize)
    );
    const institutionThreshold = institutionFontSize - 0.5;
    const educations: Education[] = [];
    let currentEducation: Partial<Education> | null = null;

    for (const line of educationLines) {
      const normalizedLine = normalizeWhitespace(line.text);

      if (
        !normalizedLine ||
        normalizedLine.length < 2 ||
        /^page\s+\d+\s+of\s+\d+$/i.test(normalizedLine)
      ) {
        continue;
      }

      const isInstitutionLine =
        line.fontSize >= institutionThreshold &&
        (this.looksLikeInstitutionHeading(normalizedLine) ||
          !this.looksLikeDegree(normalizedLine)) &&
        !this.looksLikeYear(normalizedLine);

      if (isInstitutionLine) {
        if (currentEducation?.institution) {
          educations.push(this.fillDefaults(currentEducation));
        }

        currentEducation = {
          degree: '',
          institution: normalizedLine,
          location: '',
          year: '',
        };
        continue;
      }

      if (!currentEducation) {
        currentEducation = {
          degree: '',
          institution: normalizedLine,
          location: '',
          year: '',
        };
        continue;
      }

      this.addStructuralEducationDetail({
        education: currentEducation,
        line: normalizedLine,
      });
    }

    if (currentEducation?.institution) {
      educations.push(this.fillDefaults(currentEducation));
    }

    return educations;
  }

  private static looksLikeInstitution(line: string): boolean {
    return (
      line.length > 5 &&
      line.length < 100 &&
      (this.looksLikeInstitutionHeading(line) ||
        /^[\p{Lu}][\p{L}\p{M}]+(?:\s+[\p{Lu}][\p{L}\p{M}]*)*$/u.test(line)) &&
      !this.looksLikeDegree(line) &&
      !this.looksLikeYear(line)
    );
  }

  private static looksLikeInstitutionHeading(line: string): boolean {
    return /university|college|school|institute/i.test(line);
  }

  private static looksLikeDegree(line: string): boolean {
    const lower = line.toLowerCase();

    return (
      line.length > 3 &&
      line.length < 80 &&
      /\b(?:a\.?b\.?|b\.?a\.?|b\.?s\.?|s\.?m\.?|bachelor|master|phd|mba|associate|diploma|certificate|economics|engineering|executive program|science|business|baccalaureate|bacharelado|bacharel|licenciatura|mestrado|mestre|doutorado|doutor|p[oó]s[-\s]?gradua[cç][aã]o|tecn[oó]logo|tecnologia|certifica[cç][aã]o)\b/.test(
        lower
      ) &&
      !/^\s*[()·-]?\s*(19|20)\d{2}/.test(line)
    );
  }

  private static looksLikeYear(line: string): boolean {
    return (
      /^\d{4}$/.test(line) ||
      /\b(19|20)\d{2}\b/.test(line) ||
      /\d{4}\s*-\s*\d{4}/.test(line) ||
      /\d{4}\s*-\s*present/i.test(line) ||
      /\(\d{4}\s*-\s*\d{4}\)/.test(line) ||
      looksLikeDateRangeText(line)
    );
  }

  private static extractYearFromLine(line: string): string {
    // Extract year patterns from lines that might contain both degree and year info
    const yearPatterns = [
      /\((?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{4}\s*-\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{4}\)/i,
      /\((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\)/i,
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
        .replace(
          /\s*[·-]?\s*\((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:19|20)\d{2}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:19|20)\d{2}\)\s*/gi,
          ' '
        )
        .replace(
          /\s*[·-]?\s*\((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:19|20)\d{2}\)\s*/gi,
          ' '
        )
        .replace(/\s*[·-]?\s*\((?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}\)\s*/g, ' ')
        .replace(/\s*[·-]?\s*(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}\s*/g, ' ')
        .replace(/\s*[·-]?\s*\((?:19|20)\d{2}\)\s*/g, ' ')
        .replace(/\s*[·-]?\s*\b(?:19|20)\d{2}\b\s*/g, ' ')
        .replace(/[·()]+$/g, '')
    );
  }

  private static looksLikeLocation(line: string): boolean {
    const hasLocationShape =
      isLikelyLocationText(line) ||
      (line.includes(',') && this.LOCATION_PATTERN.test(line));

    return (
      line.length > 2 &&
      line.length < 50 &&
      hasLocationShape &&
      !this.looksLikeYear(line) &&
      !this.looksLikeDegree(line)
    );
  }

  private static fillDefaults(education: Partial<Education>): Education {
    const dateText = education.year || undefined;
    const dates = dateText ? parseProfileDateRange(dateText) : undefined;

    return {
      ...(dates ? { dates } : {}),
      institution: education.institution || '',
      degree: education.degree || '',
      year: education.year || '',
      location: education.location || '',
    };
  }

  private static extractStructuralEducationLines(
    lines: StructuralLine[]
  ): StructuralLine[] {
    const mainLines = lines.filter(
      line => line.column === 'right' || line.column === 'single'
    );
    const educationStartIndex = mainLines.findIndex(line =>
      isEducationSectionHeaderText(line.text)
    );

    if (educationStartIndex === -1) {
      return [];
    }

    const followingLines = mainLines.slice(educationStartIndex + 1);
    const nextSectionIndex = followingLines.findIndex(line =>
      isSectionHeaderText(line.text)
    );

    return nextSectionIndex === -1
      ? followingLines
      : followingLines.slice(0, nextSectionIndex);
  }

  private static addStructuralEducationDetail({
    education,
    line,
  }: {
    education: Partial<Education>;
    line: string;
  }): void {
    const year = this.extractYearFromLine(line);
    const degree = year ? this.removeYearFromDegree(line) : line;
    const existingDegree = education.degree || undefined;

    if (
      !existingDegree &&
      !year &&
      this.looksLikeInstitutionContinuation({
        institution: education.institution,
        line,
      })
    ) {
      education.institution = normalizeWhitespace(
        `${education.institution ?? ''} ${line}`
      );
      return;
    }

    if (year) {
      education.year = year;
    }

    if (
      this.shouldAppendStructuralDegreePart({
        degreePart: degree,
        existingDegree,
        line,
        year,
      })
    ) {
      education.degree = existingDegree
        ? this.appendDegreeText({
            degreePart: degree,
            existingDegree,
          })
        : degree;
      return;
    }

    if (year) {
      if (!existingDegree && degree) {
        education.degree = degree;
      }

      return;
    }

    if (this.looksLikeYear(line)) {
      education.year = line;
      return;
    }

    if (!existingDegree && this.looksLikeDegreeDetail(line)) {
      education.degree = degree;
      return;
    }

    if (this.looksLikeLocation(line)) {
      education.location = line;
      return;
    }

    if (!existingDegree) {
      education.degree = degree;
      return;
    }
  }

  private static shouldAppendStructuralDegreePart({
    existingDegree,
    degreePart,
    line,
    year,
  }: ShouldAppendStructuralDegreePartParams): boolean {
    if (!degreePart) {
      return false;
    }

    if (this.looksLikeDegree(line)) {
      return true;
    }

    if (existingDegree === undefined) {
      return false;
    }

    if (year.length > 0) {
      return !this.looksLikeLocation(line);
    }

    return this.looksLikeStructuralDegreeContinuation({
      degreePart,
      existingDegree,
    });
  }

  private static looksLikeInstitutionContinuation({
    institution,
    line,
  }: {
    institution?: string;
    line: string;
  }): boolean {
    const normalizedInstitution = institution?.trim() ?? '';
    const normalizedLine = line.trim();
    const hasInstitutionBoundary = /[-,/&]\s*$/u.test(normalizedInstitution);
    const hasInstitutionConnector = /\b(?:and|at|for|in|of|the)\s*$/iu.test(
      normalizedInstitution
    );
    const hasSchoolOfContinuation =
      /\b(?:school|college)\s+of(?:\s+\p{Lu}[\p{L}\p{M}]*)?$/iu.test(
        normalizedInstitution
      ) && /^[\p{Lu}][\p{L}\p{M}]+$/u.test(normalizedLine);

    return (
      normalizedInstitution.length > 0 &&
      normalizedLine.length > 1 &&
      normalizedLine.length < 50 &&
      !this.looksLikeYear(normalizedLine) &&
      !this.looksLikeLocation(normalizedLine) &&
      (hasSchoolOfContinuation ||
        (!this.looksLikeDegree(normalizedLine) &&
          (hasInstitutionBoundary || hasInstitutionConnector)))
    );
  }

  private static looksLikeDegreeDetail(line: string): boolean {
    return (
      this.looksLikeDegree(line) ||
      /^(?:A\.?B\.?|B\.?A\.?|B\.?S\.?|S\.?M\.?)(?:\b|,)/iu.test(line) ||
      this.looksLikeShortAcademicFragment(line)
    );
  }

  private static looksLikeStructuralDegreeContinuation({
    existingDegree,
    degreePart,
  }: StructuralDegreeContinuationParams): boolean {
    const hasContinuationBoundary =
      this.STRUCTURAL_DEGREE_BOUNDARY_PATTERN.test(existingDegree) ||
      this.STRUCTURAL_DEGREE_COMMA_CONNECTOR_PATTERN.test(existingDegree) ||
      this.STRUCTURAL_DEGREE_WORD_CONNECTOR_PATTERN.test(existingDegree);
    const isShortAcademicFragment =
      this.looksLikeShortAcademicFragment(degreePart);
    const hasAcademicFragmentContinuation =
      this.hasCommaDelimitedAcademicFragment(existingDegree) &&
      isShortAcademicFragment;

    return (
      (hasContinuationBoundary || hasAcademicFragmentContinuation) &&
      isShortAcademicFragment
    );
  }

  private static hasCommaDelimitedAcademicFragment(degree: string): boolean {
    const fragments = degree.split(',');
    const finalFragment = fragments.length > 1 ? fragments.at(-1) : undefined;

    return finalFragment
      ? this.looksLikeShortAcademicFragment(finalFragment)
      : false;
  }

  private static looksLikeShortAcademicFragment(fragment: string): boolean {
    const normalizedFragment = fragment.trim();

    return (
      normalizedFragment.split(/\s+/).length <= 4 &&
      this.STRUCTURAL_ACADEMIC_FRAGMENT_PATTERN.test(normalizedFragment)
    );
  }

  private static appendDegreeText({
    existingDegree,
    degreePart,
  }: AppendDegreeTextParams): string {
    // A trailing slash already joins compound degree labels, so separator stays empty.
    const separator = existingDegree.trim().endsWith('/') ? '' : ' ';

    return normalizeWhitespace(`${existingDegree}${separator}${degreePart}`);
  }

  private static createEducationWarnings(
    educations: Education[],
    lines: string[]
  ): SectionParseWarning[] {
    const warnings: SectionParseWarning[] = [];
    const meaningfulLines = lines
      .map(line => normalizeWhitespace(line))
      .filter(line => line.length > 0 && !/^page\s+\d+/i.test(line));

    if (meaningfulLines.length > 0 && educations.length === 0) {
      warnings.push({
        code: 'section_parse_warning',
        field: 'entry',
        message: 'Detected an education section but could not extract entries',
        rawText: meaningfulLines.join(' '),
        section: 'education',
      });
    }

    educations.forEach((education, entry) => {
      if (!education.institution) {
        warnings.push({
          code: 'section_parse_warning',
          entry,
          field: 'institution',
          message: 'Could not extract institution for education entry',
          rawText: education.degree,
          section: 'education',
        });
      }

      if (education.year && !education.dates) {
        warnings.push({
          code: 'section_parse_warning',
          entry,
          field: 'dates',
          message: 'Could not parse education date range',
          rawText: education.year,
          section: 'education',
        });
      }
    });

    return warnings;
  }
}
