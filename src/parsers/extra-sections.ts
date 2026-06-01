import type { StructuralLine } from '../utils/structural-lines.js';
import {
  PROFILE_SECTION_HEADER_ENTRIES,
  type ProfileSectionKey,
} from '../utils/profile-section-headers.js';
import {
  canMergeWrappedStructuralListLine,
  mergeWrappedStructuralListLines,
} from '../utils/sidebar-list-lines.js';
import { hasSentenceTerminalPunctuation } from '../utils/profile-text.js';
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
  patents: string[];
  organizations: string[];
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
    section === 'patents' ||
    section === 'organizations' ||
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
      sections.patents.push(...columnSections.value.patents);
      sections.organizations.push(...columnSections.value.organizations);
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
    patents: sections.patents,
    organizations: sections.organizations,
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
  let activeSectionLines: StructuralLine[] = [];

  function flushActiveSectionLines(): void {
    if (activeSectionLines.length === 0) {
      return;
    }

    mergedLines.push(...mergeWrappedStructuralListLines(activeSectionLines));
    activeSectionLines = [];
  }

  for (const line of lines) {
    const header = getSectionHeader(line.text);

    // Known section headers can also appear as wrapped entry text; keep them
    // with the active section only when the shared visual-wrap evidence matches.
    if (
      header &&
      shouldTreatHeaderAsWrappedSectionEntry({
        activeSectionLines,
        line,
      })
    ) {
      activeSectionLines.push(line);
      continue;
    }

    if (header?.kind === 'target') {
      flushActiveSectionLines();
      activeSection = header.key;
      mergedLines.push(line.text);
      continue;
    }

    if (header?.kind === 'boundary') {
      flushActiveSectionLines();
      activeSection = undefined;
      mergedLines.push(line.text);
      continue;
    }

    if (activeSection) {
      activeSectionLines.push(line);
      continue;
    }

    mergedLines.push(line.text);
  }

  flushActiveSectionLines();

  return mergedLines;
}

function shouldTreatHeaderAsWrappedSectionEntry({
  activeSectionLines,
  line,
}: {
  activeSectionLines: StructuralLine[];
  line: StructuralLine;
}): boolean {
  const previousLine = activeSectionLines.at(-1);

  // Reuse the list-line wrap predicate so extra sections honor the same
  // indentation and typography evidence as structural list parsing.
  return (
    previousLine !== undefined &&
    canMergeWrappedStructuralListLine(previousLine, line)
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
    patents: [],
    organizations: [],
  };
}

function getSectionHeader(line: string): SectionHeader | undefined {
  if (hasSentenceTerminalPunctuation(line)) {
    return undefined;
  }

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
    if (sections[section].length > 0 || section === 'organizations') {
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
