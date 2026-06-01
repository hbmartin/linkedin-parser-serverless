import type { StructuralLine } from './structural-lines.js';
import {
  PROFILE_SECTION_HEADER_ENTRIES,
  type ProfileSectionKey,
} from './profile-section-headers.js';
import { normalizeWhitespace, splitLines } from './text-utils.js';

type ParserLineSource = 'text' | 'structural';

export type ParserLineSection = 'identity' | ProfileSectionKey | 'other';

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

const TARGET_SECTION_HEADERS = new Map<string, ParserLineSection>(
  PROFILE_SECTION_HEADER_ENTRIES
);

const BOUNDARY_SECTION_HEADERS = new Set([
  'courses',
  'patents',
  'organizations',
  'recommendations',
  'interests',
]);
const SECTION_HEADER_CANDIDATE_LENGTH_PADDING = 8;
const MAX_SECTION_HEADER_CANDIDATE_LENGTH =
  Math.max(
    ...[...TARGET_SECTION_HEADERS.keys(), ...BOUNDARY_SECTION_HEADERS].map(
      header => header.length
    )
  ) + SECTION_HEADER_CANDIDATE_LENGTH_PADDING;
// oxlint-disable-next-line no-control-regex -- This intentionally tests for text outside the ASCII range.
const NON_ASCII_TEXT_PATTERN = /[^\u0000-\u007F]/;
const COMBINING_MARK_PATTERN = /\p{M}/gu;
const AMPERSAND_PATTERN = /&/g;
const NON_HEADER_WORD_PATTERN = /[^a-zA-Z\s]/g;
const MULTIPLE_SPACES_PATTERN = /\s+/g;

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
    column?: StructuralLine['column'];
  }[]
): NormalizedParserLine[] {
  return enrichParserLines(
    groups.map((line, index) => ({
      fontSize: line.fontSize,
      column: line.column,
      index,
      source: 'structural',
      text: normalizeWhitespace(line.text),
      x: line.x,
      y: line.y,
    }))
  );
}

function normalizeSectionHeader(text: string): string {
  const whitespaceNormalized = normalizeWhitespace(text);
  const accentlessText = NON_ASCII_TEXT_PATTERN.test(whitespaceNormalized)
    ? whitespaceNormalized.normalize('NFD').replace(COMBINING_MARK_PATTERN, '')
    : whitespaceNormalized;

  return accentlessText
    .replace(AMPERSAND_PATTERN, ' and ')
    .replace(NON_HEADER_WORD_PATTERN, ' ')
    .replace(MULTIPLE_SPACES_PATTERN, ' ')
    .trim()
    .toLowerCase();
}

export function getParserLineSectionHeader(
  text: string
): SectionHeader | undefined {
  const trimmedText = text.trim();

  if (
    trimmedText.length === 0 ||
    trimmedText.length > MAX_SECTION_HEADER_CANDIDATE_LENGTH ||
    /[.!?]$/u.test(trimmedText)
  ) {
    return undefined;
  }

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
