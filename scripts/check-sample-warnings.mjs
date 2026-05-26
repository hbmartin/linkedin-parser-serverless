import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseLinkedInPDF } from '../dist/index.js';
import {
  defaultSamplesDir,
  readSortedPdfFileNames,
  repoRoot,
  sampleWarningFailureDetailLines,
  sectionParseWarnings,
  unknownErrorMessage,
} from './lib/sample-script-helpers.mjs';

const samplesDir = defaultSamplesDir;
const pdfFileNames = await readSortedPdfFileNames(
  samplesDir,
  `No sample PDFs found in ${samplesDir}`
);

const failures = [];

for (const pdfFileName of pdfFileNames) {
  const pdfPath = path.join(samplesDir, pdfFileName);

  try {
    const result = await parseLinkedInPDF(await fs.readFile(pdfPath));
    const warnings = sectionParseWarnings(result);

    if (warnings.length === 0) {
      continue;
    }

    failures.push({
      pdfFileName,
      warnings,
    });
  } catch (error) {
    failures.push({
      parseError: unknownErrorMessage(error),
      pdfFileName,
      warnings: [],
    });
  }
}

if (failures.length > 0) {
  const details = sampleWarningFailureDetailLines(failures).join('\n');

  throw new Error(
    `Found section_parse_warning warnings in sample PDFs:\n${details}`
  );
}

console.log(
  `No section_parse_warning warnings found in ${pdfFileNames.length} sample PDF(s).`
);
