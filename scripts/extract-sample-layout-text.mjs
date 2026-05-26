#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  defaultSamplesDir,
  execFileAsync,
  optionValue,
  readSortedPdfFileNames,
  repoRoot,
  unknownErrorMessage,
} from './lib/sample-script-helpers.mjs';

const defaultOutputDir = path.join(
  repoRoot,
  '.debug-dist',
  'sample-layout-text'
);

const samplesDir = path.resolve(
  repoRoot,
  optionValue('--samples') ?? defaultSamplesDir
);
const outputDir = path.resolve(
  repoRoot,
  optionValue('--output') ?? defaultOutputDir
);

function layoutTextName(pdfFileName) {
  return `${path.basename(pdfFileName, path.extname(pdfFileName))}.layout.txt`;
}

const pdfFileNames = await readSortedPdfFileNames(
  samplesDir,
  `No PDF files found in ${samplesDir}`
);

await fs.mkdir(outputDir, { recursive: true });

const extractedFiles = [];
const failures = [];

for (const pdfFileName of pdfFileNames) {
  const pdfPath = path.join(samplesDir, pdfFileName);
  const outputPath = path.join(outputDir, layoutTextName(pdfFileName));

  try {
    await execFileAsync('pdftotext', ['-layout', pdfPath, outputPath]);
    extractedFiles.push({
      pdfFileName,
      outputPath: path.relative(repoRoot, outputPath),
    });
  } catch (error) {
    failures.push({
      pdfFileName,
      message: unknownErrorMessage(error),
    });
  }
}

await fs.writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      samplesDir: path.relative(repoRoot, samplesDir),
      outputDir: path.relative(repoRoot, outputDir),
      files: extractedFiles,
      failures,
    },
    null,
    2
  )}\n`
);

if (failures.length > 0) {
  const details = failures
    .map(failure => `${failure.pdfFileName}: ${failure.message}`)
    .join('\n');

  throw new Error(`Failed to extract layout text for PDFs:\n${details}`);
}

console.log(
  `Extracted layout text for ${extractedFiles.length} sample PDF(s) to ${path.relative(
    repoRoot,
    outputDir
  )}.`
);
