import type { StructuralLine } from '../utils/structural-lines.js';
import { normalizeWhitespace, splitLines } from '../utils/text-utils.js';
import type {
  ParsedSectionResult,
  SectionParseWarning,
  WarningSection,
} from '../types/profile.js';

export interface ExtraProfileSections {
  certifications: string[];
  volunteer_work: string[];
  projects: string[];
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

const TARGET_SECTION_HEADERS = new Map<string, ExtraSectionKey>([
  ['certifications', 'certifications'],
  ['licenses and certifications', 'certifications'],
  ['licences and certifications', 'certifications'],
  ['certificacoes', 'certifications'],
  ['certificacoes e licencas', 'certifications'],
  ['certificacoes e licencas', 'certifications'],
  ['projects', 'projects'],
  ['projetos', 'projects'],
  ['volunteer experience', 'volunteer_work'],
  ['volunteer work', 'volunteer_work'],
  ['volunteering', 'volunteer_work'],
  ['experiencia voluntaria', 'volunteer_work'],
]);

const BOUNDARY_SECTION_HEADERS = new Set([
  'contact',
  'contact info',
  'top skills',
  'skills',
  'languages',
  'idiomas',
  'summary',
  'experience',
  'experiencia',
  'education',
  'formacao',
  'courses',
  'publications',
  'patents',
  'honors and awards',
  'organizations',
  'recommendations',
  'interests',
  ...TARGET_SECTION_HEADERS.keys(),
]);

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
        .map(line => cleanSectionLine(line.text));
      const columnSections = parseSectionLines(columnLines);

      sections.certifications.push(...columnSections.value.certifications);
      sections.projects.push(...columnSections.value.projects);
      sections.volunteer_work.push(...columnSections.value.volunteer_work);
      warnings.push(...columnSections.warnings);
    }

    return {
      value: sections,
      warnings: filterMergedSectionWarnings({ sections, warnings }),
    };
  }
}

function filterMergedSectionWarnings({
  sections,
  warnings,
}: {
  sections: ExtraProfileSections;
  warnings: SectionParseWarning[];
}): SectionParseWarning[] {
  const entriesByWarningSection: Partial<Record<WarningSection, string[]>> = {
    certifications: sections.certifications,
    projects: sections.projects,
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
    projects: [],
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
