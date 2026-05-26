import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);
export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
export const defaultSamplesDir = path.join(repoRoot, 'samples');

export function hasFlag(name) {
  return process.argv.includes(name);
}

export function optionValue(name) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

export async function readSortedPdfFileNames(samplesDir, emptyMessage) {
  const entries = await fs.readdir(samplesDir, { withFileTypes: true });
  const pdfFileNames = entries
    .filter(
      entry => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')
    )
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (pdfFileNames.length === 0) {
    throw new Error(emptyMessage);
  }

  return pdfFileNames;
}

export function sectionParseWarnings(parsedJson) {
  const warnings = Array.isArray(parsedJson.warnings)
    ? parsedJson.warnings
    : [];

  return warnings.filter(
    warning =>
      warning !== null &&
      typeof warning === 'object' &&
      'code' in warning &&
      warning.code === 'section_parse_warning'
  );
}

export function unknownErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
