import {
  getParserLineSectionHeader,
  type ParserLineSection,
} from './parser-lines.js';
import type { StructuralLine } from './structural-lines.js';

export interface ExtractStructuralSectionLinesParams {
  section: ParserLineSection;
  structuralLines: StructuralLine[];
}

export interface StructuralSectionLines {
  hasSection: boolean;
  lines: StructuralLine[];
}

export function extractStructuralSectionLines({
  section,
  structuralLines,
}: ExtractStructuralSectionLinesParams): StructuralSectionLines {
  const activeSectionsByColumn = new Map<
    StructuralLine['column'],
    ParserLineSection
  >();
  const lines: StructuralLine[] = [];
  let hasSection = false;

  for (const line of structuralLines) {
    const header = getParserLineSectionHeader(line.text);

    if (header?.kind === 'target' && header.section) {
      activeSectionsByColumn.set(line.column, header.section);

      if (header.section === section) {
        hasSection = true;
      }

      continue;
    }

    if (header?.kind === 'boundary') {
      activeSectionsByColumn.set(line.column, 'other');
      continue;
    }

    if (activeSectionsByColumn.get(line.column) === section) {
      lines.push(line);
    }
  }

  return {
    hasSection,
    lines,
  };
}
