import { StructuralParser } from './parsers/structural-parser.js';
import { createStructuralLines } from './utils/structural-lines.js';
import type { LayoutInfo, TextItem } from './types/structural.js';
import type { StructuralLine } from './utils/structural-lines.js';

export interface LinkedInPDFSourceDebugArtifacts {
  layout: LayoutInfo;
  rawText: string;
  structuralLines: StructuralLine[];
  textItems: TextItem[];
}

export async function extractLinkedInPDFSourceDebug(
  input: ArrayBuffer | Uint8Array
): Promise<LinkedInPDFSourceDebugArtifacts> {
  const structuralData = await StructuralParser.extractStructuredText(input);
  const rawText = createRawTextFromTextItems({
    layout: structuralData.layout,
    textItems: structuralData.textItems,
  });
  const structuralLines = createStructuralLines({
    layout: structuralData.layout,
    textItems: structuralData.textItems,
  });

  return {
    layout: structuralData.layout,
    rawText,
    structuralLines,
    textItems: structuralData.textItems,
  };
}

interface CreateRawTextFromTextItemsParams {
  layout: LayoutInfo;
  textItems: TextItem[];
}

function createRawTextFromTextItems({
  layout,
  textItems,
}: CreateRawTextFromTextItemsParams): string {
  const groups = StructuralParser.groupTextByProximity({
    layout,
    textItems,
  });
  const lines = StructuralParser.combineGroupedText(groups);

  return lines.join('\n');
}
