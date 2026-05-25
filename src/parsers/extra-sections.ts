import type { StructuralLine } from '../utils/structural-lines.js';
import {
  PROFILE_SECTION_HEADER_ENTRIES,
  type ProfileSectionKey,
} from '../utils/profile-section-headers.js';
import { normalizeWhitespace, splitLines } from '../utils/text-utils.js';
import type {
  ParsedSectionResult,
  SectionParseWarning,
  WarningSection,
} from '../types/profile.js';

export interface ExtraProfileSections {
  certifications: string[];
  honors_awards: string[];
  volunteer_work: string[];
  projects: string[];
  publications: string[];
}

type ExtraSectionKey = keyof ExtraProfileSections;

type SectionHeader =
  | {
      kind: 'target';
      key: ExtraSectionKey;
    }
  | {
      kind: 'boundary';
    };

const TARGET_SECTION_HEADERS = new Map<string, ExtraSectionKey>(
  createTargetSectionHeaderEntries()
);

const BOUNDARY_SECTION_HEADERS = new Set<string>([
  ...PROFILE_SECTION_HEADER_ENTRIES.map(([text]) =>
    normalizeSectionHeader(text)
  ),
  'courses',
  'patents',
  'organizations',
  'recommendations',
  'interests',
  ...TARGET_SECTION_HEADERS.keys(),
]);

function createTargetSectionHeaderEntries(): Array<
  readonly [string, ExtraSectionKey]
> {
  const entries: Array<readonly [string, ExtraSectionKey]> = [];

  for (const [text, section] of PROFILE_SECTION_HEADER_ENTRIES) {
    if (isExtraSectionKey(section)) {
      entries.push([normalizeSectionHeader(text), section]);
    }
  }

  return entries;
}

function isExtraSectionKey(
  section: ProfileSectionKey
): section is ExtraSectionKey {
  return (
    section === 'certifications' ||
    section === 'honors_awards' ||
    section === 'projects' ||
    section === 'publications' ||
    section === 'volunteer_work'
  );
}

export class ExtraSectionParser {
  static parseText(text: string): ExtraProfileSections {
    return this.parseTextWithWarnings(text).value;
  }

  static parseTextWithWarnings(
    text: string
  ): ParsedSectionResult<ExtraProfileSections> {
    return parseSectionLines(splitLines(text).map(cleanSectionLine));
  }

  static parseStructural(lines: StructuralLine[]): ExtraProfileSections {
    return this.parseStructuralWithWarnings(lines).value;
  }

  static parseStructuralWithWarnings(
    lines: StructuralLine[]
  ): ParsedSectionResult<ExtraProfileSections> {
    const sections = createEmptySections();
    const warnings: SectionParseWarning[] = [];
    const columns: StructuralLine['column'][] = ['left', 'right', 'single'];

    for (const column of columns) {
      const columnLines = lines
        .filter(line => line.column === column)
        .map(line => ({
          ...line,
          text: cleanSectionLine(line.text),
        }));
      const mergedColumnLines = mergeWrappedStructuralSectionLines(columnLines);
      const columnSections = parseSectionLines(mergedColumnLines);

      sections.certifications.push(...columnSections.value.certifications);
      sections.honors_awards.push(...columnSections.value.honors_awards);
      sections.projects.push(...columnSections.value.projects);
      sections.publications.push(...columnSections.value.publications);
      sections.volunteer_work.push(...columnSections.value.volunteer_work);
      warnings.push(...columnSections.warnings);
    }

    return {
      value: sections,
      warnings: filterMergedSectionWarnings({ sections, warnings }),
    };
  }
}

export function filterMergedSectionWarnings({
  sections,
  warnings,
}: {
  sections: ExtraProfileSections;
  warnings: SectionParseWarning[];
}): SectionParseWarning[] {
  const entriesByWarningSection: Partial<Record<WarningSection, string[]>> = {
    certifications: sections.certifications,
    honors_awards: sections.honors_awards,
    projects: sections.projects,
    publications: sections.publications,
    volunteer_work: sections.volunteer_work,
  };
  const emittedEmptySectionWarnings = new Set<WarningSection>();

  return warnings.filter(warning => {
    if (warning.field !== 'section') {
      return true;
    }

    const entries = entriesByWarningSection[warning.section];

    if (entries === undefined) {
      return true;
    }

    if (entries.length > 0) {
      return false;
    }

    if (emittedEmptySectionWarnings.has(warning.section)) {
      return false;
    }

    emittedEmptySectionWarnings.add(warning.section);
    return true;
  });
}

function mergeWrappedStructuralSectionLines(lines: StructuralLine[]): string[] {
  const mergedLines: string[] = [];
  let activeSection: ExtraSectionKey | undefined;
  let previousEntry:
    | {
        line: StructuralLine;
        mergedLineIndex: number;
      }
    | undefined;

  for (const line of lines) {
    const header = getSectionHeader(line.text);

    if (header?.kind === 'target') {
      activeSection = header.key;
      previousEntry = undefined;
      mergedLines.push(line.text);
      continue;
    }

    if (header?.kind === 'boundary') {
      activeSection = undefined;
      previousEntry = undefined;
      mergedLines.push(line.text);
      continue;
    }

    if (
      activeSection &&
      previousEntry &&
      isWrappedStructuralEntryLine(previousEntry.line, line)
    ) {
      mergedLines[previousEntry.mergedLineIndex] = normalizeWhitespace(
        `${mergedLines[previousEntry.mergedLineIndex]} ${line.text}`
      );
      previousEntry = {
        line,
        mergedLineIndex: previousEntry.mergedLineIndex,
      };
      continue;
    }

    mergedLines.push(line.text);
    previousEntry = activeSection
      ? {
          line,
          mergedLineIndex: mergedLines.length - 1,
        }
      : undefined;
  }

  return mergedLines;
}

function isWrappedStructuralEntryLine(
  previousLine: StructuralLine,
  line: StructuralLine
): boolean {
  const yGap = previousLine.y - line.y;
  const maxExpectedWrapGap = Math.max(previousLine.height, line.height) + 4;
  const isAligned = Math.abs(previousLine.x - line.x) <= 8;
  const hasSimilarFontSize =
    Math.abs(previousLine.fontSize - line.fontSize) < 1;

  return (
    yGap > 0 && yGap <= maxExpectedWrapGap && isAligned && hasSimilarFontSize
  );
}

function parseSectionLines(
  lines: string[]
): ParsedSectionResult<ExtraProfileSections> {
  const sections = createEmptySections();
  const detectedSections = new Set<ExtraSectionKey>();
  let activeSection: ExtraSectionKey | undefined;

  for (const line of lines) {
    if (!line || /^page\s+\d+\s+of\s+\d+$/i.test(line)) {
      continue;
    }

    const header = getSectionHeader(line);

    if (header?.kind === 'target') {
      activeSection = header.key;
      detectedSections.add(header.key);
      continue;
    }

    if (header?.kind === 'boundary') {
      activeSection = undefined;
      continue;
    }

    if (activeSection) {
      sections[activeSection].push(line);
    }
  }

  return {
    value: sections,
    warnings: createExtraSectionWarnings(sections, detectedSections),
  };
}

function createEmptySections(): ExtraProfileSections {
  return {
    certifications: [],
    honors_awards: [],
    projects: [],
    publications: [],
    volunteer_work: [],
  };
}

function getSectionHeader(line: string): SectionHeader | undefined {
  const normalizedHeader = normalizeSectionHeader(line);
  const targetSection = TARGET_SECTION_HEADERS.get(normalizedHeader);

  if (targetSection) {
    return {
      kind: 'target',
      key: targetSection,
    };
  }

  return BOUNDARY_SECTION_HEADERS.has(normalizedHeader)
    ? { kind: 'boundary' }
    : undefined;
}

function cleanSectionLine(line: string): string {
  return normalizeWhitespace(
    line
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/^[•*-]\s*/, '')
  );
}

function normalizeSectionHeader(line: string): string {
  return cleanSectionLine(line)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function createExtraSectionWarnings(
  sections: ExtraProfileSections,
  detectedSections: Set<ExtraSectionKey>
): SectionParseWarning[] {
  const warnings: SectionParseWarning[] = [];

  for (const section of detectedSections) {
    if (sections[section].length > 0) {
      continue;
    }

    warnings.push({
      code: 'section_parse_warning',
      field: 'section',
      message: `Detected a ${section} section but could not extract entries`,
      section,
    });
  }

  return warnings;
}
