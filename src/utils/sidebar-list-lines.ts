import type { StructuralLine } from './structural-lines.js';
import { normalizeWhitespace } from './text-utils.js';

export function mergeWrappedStructuralListLines(
  lines: StructuralLine[]
): string[] {
  const mergedLines: string[] = [];
  let previousEntry:
    | {
        line: StructuralLine;
        mergedLineIndex: number;
      }
    | undefined;

  for (const line of lines) {
    if (
      previousEntry &&
      canMergeWrappedStructuralListLine(previousEntry.line, line)
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

    mergedLines.push(normalizeWhitespace(line.text));
    previousEntry = {
      line,
      mergedLineIndex: mergedLines.length - 1,
    };
  }

  return mergedLines;
}

function canMergeWrappedStructuralListLine(
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
