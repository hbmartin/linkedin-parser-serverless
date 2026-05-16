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
      // Keep section context isolated per visual column to avoid cross-column leakage.
      activeSectionsByColumn.set(line.column, header.section);

      if (header.section === section) {
        hasSection = true;
      }

      continue;
    }

    if (header?.kind === 'boundary') {
      // Boundary headers close the active section for this column only.
      activeSectionsByColumn.set(line.column, 'other');
      continue;
    }

    if (activeSectionsByColumn.get(line.column) === section) {
      // Collect only lines in the requested active section for this column.
      lines.push(line);
    }
  }

  return {
    hasSection,
    lines,
  };
}
