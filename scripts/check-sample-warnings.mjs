import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseLinkedInPDF } from '../dist/index.js';
import {
  defaultSamplesDir,
  readSortedPdfFileNames,
  repoRoot,
  sectionParseWarnings,
} from './lib/sample-script-helpers.mjs';

const samplesDir = defaultSamplesDir;
const pdfFileNames = await readSortedPdfFileNames(
  samplesDir,
  `No sample PDFs found in ${samplesDir}`
);

const failures = [];

for (const pdfFileName of pdfFileNames) {
  const pdfPath = path.join(samplesDir, pdfFileName);
  const result = await parseLinkedInPDF(await fs.readFile(pdfPath));
  const warnings = sectionParseWarnings(result);

  if (warnings.length === 0) {
    continue;
  }

  failures.push({
    pdfFileName,
    warnings,
  });
}

if (failures.length > 0) {
  const details = failures
    .flatMap(failure =>
      failure.warnings.map(warning => {
        const field = warning.field ? `.${warning.field}` : '';
        const entry = warning.entry === undefined ? '' : `#${warning.entry}`;
        const rawText = warning.rawText ? `: ${warning.rawText}` : '';

        return `${failure.pdfFileName} ${warning.section}${field}${entry} ${warning.message}${rawText}`;
      })
    )
    .join('\n');

  throw new Error(
    `Found section_parse_warning warnings in sample PDFs:\n${details}`
  );
}

console.log(
  `No section_parse_warning warnings found in ${pdfFileNames.length} sample PDF(s).`
);
