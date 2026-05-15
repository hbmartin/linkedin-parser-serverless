import type { StructuralLine } from '../utils/structural-lines.js';
import { normalizeWhitespace, splitLines } from '../utils/text-utils.js';

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
    return parseSectionLines(splitLines(text).map(cleanSectionLine));
  }

  static parseStructural(lines: StructuralLine[]): ExtraProfileSections {
    const sections = createEmptySections();
    const columns: StructuralLine['column'][] = ['left', 'right', 'single'];

    for (const column of columns) {
      const columnLines = lines
        .filter(line => line.column === column)
        .map(line => cleanSectionLine(line.text));
      const columnSections = parseSectionLines(columnLines);

      sections.certifications.push(...columnSections.certifications);
      sections.projects.push(...columnSections.projects);
      sections.volunteer_work.push(...columnSections.volunteer_work);
    }

    return sections;
  }
}

function parseSectionLines(lines: string[]): ExtraProfileSections {
  const sections = createEmptySections();
  let activeSection: ExtraSectionKey | undefined;

  for (const line of lines) {
    if (!line || /^page\s+\d+\s+of\s+\d+$/i.test(line)) {
      continue;
    }

    const header = getSectionHeader(line);

    if (header?.kind === 'target') {
      activeSection = header.key;
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

  return sections;
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
