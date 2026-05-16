import type { StructuralLine } from './structural-lines.js';
import { normalizeWhitespace, splitLines } from './text-utils.js';

type ParserLineSource = 'text' | 'structural';

export type ParserLineSection =
  | 'identity'
  | 'contact'
  | 'summary'
  | 'top_skills'
  | 'languages'
  | 'certifications'
  | 'volunteer_work'
  | 'projects'
  | 'publications'
  | 'experience'
  | 'education'
  | 'other';

export interface NormalizedParserLine {
  text: string;
  source: ParserLineSource;
  index: number;
  section: ParserLineSection;
  x?: number;
  y?: number;
  fontSize?: number;
  column?: StructuralLine['column'];
  gapBefore?: number;
  xDelta?: number;
  fontDelta?: number;
}

interface BaseParserLine {
  text: string;
  source: ParserLineSource;
  index: number;
  x?: number;
  y?: number;
  fontSize?: number;
  column?: StructuralLine['column'];
}

interface SectionHeader {
  kind: 'target' | 'boundary';
  section?: ParserLineSection;
}

const TARGET_SECTION_HEADERS = new Map<string, ParserLineSection>([
  ['contact', 'contact'],
  ['contact info', 'contact'],
  ['summary', 'summary'],
  ['top skills', 'top_skills'],
  ['skills', 'top_skills'],
  ['competencias', 'top_skills'],
  ['competências', 'top_skills'],
  ['habilidades', 'top_skills'],
  ['languages', 'languages'],
  ['idiomas', 'languages'],
  ['experience', 'experience'],
  ['experiencia', 'experience'],
  ['experiência', 'experience'],
  ['education', 'education'],
  ['formacao', 'education'],
  ['formação', 'education'],
  ['certifications', 'certifications'],
  ['licenses and certifications', 'certifications'],
  ['licences and certifications', 'certifications'],
  ['certificacoes', 'certifications'],
  ['certificações', 'certifications'],
  ['certificacoes e licencas', 'certifications'],
  ['certificações e licenças', 'certifications'],
  ['projects', 'projects'],
  ['projetos', 'projects'],
  ['publications', 'publications'],
  ['volunteer experience', 'volunteer_work'],
  ['volunteer work', 'volunteer_work'],
  ['volunteering', 'volunteer_work'],
  ['experiencia voluntaria', 'volunteer_work'],
  ['experiência voluntária', 'volunteer_work'],
]);

const BOUNDARY_SECTION_HEADERS = new Set([
  'courses',
  'patents',
  'honors and awards',
  'organizations',
  'recommendations',
  'interests',
]);

export function createTextParserLines(text: string): NormalizedParserLine[] {
  return enrichParserLines(
    splitLines(text).map((line, index) => ({
      index,
      source: 'text',
      text: normalizeWhitespace(line),
    }))
  );
}

export function createGroupedTextItemParserLines(
  groups: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
  }[]
): NormalizedParserLine[] {
  return enrichParserLines(
    groups.map((line, index) => ({
      fontSize: line.fontSize,
      index,
      source: 'structural',
      text: normalizeWhitespace(line.text),
      x: line.x,
      y: line.y,
    }))
  );
}

function normalizeSectionHeader(text: string): string {
  return normalizeWhitespace(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getParserLineSectionHeader(
  text: string
): SectionHeader | undefined {
  const normalizedHeader = normalizeSectionHeader(text);
  const section = TARGET_SECTION_HEADERS.get(normalizedHeader);

  if (section) {
    return {
      kind: 'target',
      section,
    };
  }

  return BOUNDARY_SECTION_HEADERS.has(normalizedHeader)
    ? { kind: 'boundary' }
    : undefined;
}

function enrichParserLines(
  baseLines: BaseParserLine[]
): NormalizedParserLine[] {
  const lines: NormalizedParserLine[] = [];
  let activeSection: ParserLineSection = 'identity';
  let previousLine: BaseParserLine | undefined;

  for (const line of baseLines) {
    const header = getParserLineSectionHeader(line.text);

    if (header?.kind === 'target' && header.section) {
      activeSection = header.section;
    } else if (header?.kind === 'boundary') {
      activeSection = 'other';
    }

    lines.push({
      column: line.column,
      fontDelta:
        line.fontSize !== undefined && previousLine?.fontSize !== undefined
          ? line.fontSize - previousLine.fontSize
          : undefined,
      fontSize: line.fontSize,
      gapBefore:
        line.y !== undefined && previousLine?.y !== undefined
          ? previousLine.y - line.y
          : undefined,
      index: line.index,
      section: header ? 'other' : activeSection,
      source: line.source,
      text: line.text,
      x: line.x,
      xDelta:
        line.x !== undefined && previousLine?.x !== undefined
          ? line.x - previousLine.x
          : undefined,
      y: line.y,
    });

    previousLine = line;
  }

  return lines;
}
