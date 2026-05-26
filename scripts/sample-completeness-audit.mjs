#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  defaultSamplesDir,
  execFileAsync,
  hasFlag,
  optionValue,
  readSortedPdfFileNames,
  repoRoot,
  sectionParseWarnings,
} from './lib/sample-script-helpers.mjs';
import { createSourceCoverageReport } from './lib/source-coverage-helpers.mjs';

const defaultLayoutDir = path.join(
  repoRoot,
  '.debug-dist',
  'sample-layout-text'
);
const defaultReportPath = path.join(
  repoRoot,
  '.debug-dist',
  'sample-completeness-audit.json'
);
const samplesDir = path.resolve(
  repoRoot,
  optionValue('--samples') ?? defaultSamplesDir
);
const layoutDir = path.resolve(
  repoRoot,
  optionValue('--layouts') ?? defaultLayoutDir
);
const reportPath = path.resolve(
  repoRoot,
  optionValue('--report') ?? defaultReportPath
);
const failOnUnmatched = hasFlag('--fail-on-unmatched') || hasFlag('--strict');
const failOnSectionWarnings =
  hasFlag('--fail-on-section-warnings') || hasFlag('--strict');
const failOnLooseMatches = hasFlag('--fail-on-loose') || hasFlag('--strict');
const failOnUntracedOutput =
  hasFlag('--fail-on-untraced-output') || hasFlag('--strict');

function layoutTextName(pdfFileName) {
  return `${path.basename(pdfFileName, path.extname(pdfFileName))}.layout.txt`;
}

function jsonFileName(pdfFileName) {
  return `${path.basename(pdfFileName, path.extname(pdfFileName))}.json`;
}

async function ensureLayoutText(pdfFileName) {
  await fs.mkdir(layoutDir, { recursive: true });

  const layoutPath = path.join(layoutDir, layoutTextName(pdfFileName));

  try {
    return await fs.readFile(layoutPath, 'utf8');
  } catch (error) {
    if (
      error === null ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }

  await execFileAsync('pdftotext', [
    '-layout',
    path.join(samplesDir, pdfFileName),
    layoutPath,
  ]);

  return fs.readFile(layoutPath, 'utf8');
}

const pdfFileNames = await readSortedPdfFileNames(
  samplesDir,
  `No PDF files found in ${samplesDir}`
);

const fileReports = [];

for (const pdfFileName of pdfFileNames) {
  const layoutText = await ensureLayoutText(pdfFileName);
  const jsonPath = path.join(samplesDir, jsonFileName(pdfFileName));
  const parsedJson = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const coverageReport = createSourceCoverageReport({
    layoutText,
    parsedJson,
    pdfFileName,
  });

  fileReports.push({
    ...coverageReport,
    pdfFileName,
    rawLineCount: coverageReport.rawSegmentCount,
    unmatchedLineCount: coverageReport.unmatchedSourceSegmentCount,
    unmatchedLines: coverageReport.unmatchedSourceSegments.map(
      segment => segment.text
    ),
    sectionWarnings: sectionParseWarnings(parsedJson),
  });
}

const totalRawLineCount = fileReports.reduce(
  (total, fileReport) => total + fileReport.rawLineCount,
  0
);
const totalUnmatchedLineCount = fileReports.reduce(
  (total, fileReport) => total + fileReport.unmatchedLineCount,
  0
);
const totalLooseSourceMatchCount = fileReports.reduce(
  (total, fileReport) => total + fileReport.looseSourceMatchCount,
  0
);
const totalUntracedOutputValueCount = fileReports.reduce(
  (total, fileReport) => total + fileReport.untracedOutputValueCount,
  0
);
const totalSectionWarningCount = fileReports.reduce(
  (total, fileReport) => total + fileReport.sectionWarnings.length,
  0
);
const report = {
  generatedAt: new Date().toISOString(),
  samplesDir: path.relative(repoRoot, samplesDir),
  layoutDir: path.relative(repoRoot, layoutDir),
  totalPdfCount: fileReports.length,
  totalRawLineCount,
  totalUnmatchedLineCount,
  totalLooseSourceMatchCount,
  totalUntracedOutputValueCount,
  totalSectionWarningCount,
  files: fileReports,
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  [
    `Audited ${fileReports.length} sample PDF/JSON pair(s).`,
    `Source segments: ${totalRawLineCount}.`,
    `Unmatched source segments: ${totalUnmatchedLineCount}.`,
    `Loose source matches: ${totalLooseSourceMatchCount}.`,
    `Untraced output values: ${totalUntracedOutputValueCount}.`,
    `section_parse_warning count: ${totalSectionWarningCount}.`,
    `Report: ${path.relative(repoRoot, reportPath)}.`,
  ].join('\n')
);

if (failOnSectionWarnings && totalSectionWarningCount > 0) {
  process.exitCode = 1;
}

if (failOnUnmatched && totalUnmatchedLineCount > 0) {
  process.exitCode = 1;
}

if (failOnLooseMatches && totalLooseSourceMatchCount > 0) {
  process.exitCode = 1;
}

if (failOnUntracedOutput && totalUntracedOutputValueCount > 0) {
  process.exitCode = 1;
}
