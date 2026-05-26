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
const ignoredLinePatterns = [
  /^page\s+\d+\s+of\s+\d+$/,
  /^linkedin$/,
  /^contact$/,
  /^top skills$/,
  /^languages$/,
  /^certifications$/,
  /^summary$/,
  /^experience$/,
  /^education$/,
  /^projects$/,
  /^publications$/,
  /^honors(?:[-\s]+(?:and[-\s]+)?awards)?$/,
  /^kontakt$/,
  /^berufserfahrung$/,
  /^recommendations$/,
  /^volunteer(?:ing| experience)?$/,
  /^interests$/,
  /^causes$/,
  /^activity$/,
  /^open profile$/,
  /^resources\/\d+-\d+\/$/,
];

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

function normalizeText(value) {
  return value
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[•·]/g, ' ')
    .replace(/([a-z])\.([A-Z])/g, '$1. $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function layoutTextName(pdfFileName) {
  return `${path.basename(pdfFileName, path.extname(pdfFileName))}.layout.txt`;
}

function jsonFileName(pdfFileName) {
  return `${path.basename(pdfFileName, path.extname(pdfFileName))}.json`;
}

function ignoredRawLine(line) {
  const normalized = normalizeText(line);

  return (
    normalized.length === 0 ||
    ignoredLinePatterns.some(pattern => pattern.test(normalized))
  );
}

function rawLineVariants(line) {
  const normalized = normalizeText(line);
  const withoutBullet = normalized.replace(/^[-*]\s+/, '');
  const withoutContactKind = withoutBullet.replace(
    /\s+\((?:mobile|home|work)\)$/,
    ''
  );
  const withoutLabel = withoutBullet.replace(
    /^[a-z][a-z0-9 /&.'-]{1,32}:\s+/,
    ''
  );
  const urlAsHttps = withoutLabel.replace(/^www\./, 'https://www.');
  const urlWithoutScheme = withoutLabel.replace(/^https?:\/\//, '');

  return [
    ...new Set([
      normalized,
      withoutBullet,
      withoutContactKind,
      withoutLabel,
      urlAsHttps,
      urlWithoutScheme,
    ]),
  ].filter(variant => variant.length > 0);
}

function collectJsonScalars(value, scalars) {
  if (typeof value === 'string') {
    scalars.push(value);
    return;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    scalars.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonScalars(item, scalars);
    }
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const childValue of Object.values(value)) {
      collectJsonScalars(childValue, scalars);
    }
  }
}

function searchableJsonText(parsedJson) {
  const scalars = [];
  collectJsonScalars(parsedJson, scalars);

  return normalizeText(scalars.join(' '));
}

function meaningfulTokens(value) {
  return normalizeText(value)
    .split(/[^a-z0-9+/#]+/)
    .filter(token => token.length >= 2)
    .filter(token => !/^\d+$/.test(token));
}

function segmentRepresentedInJson(line, jsonText) {
  for (const variant of rawLineVariants(line)) {
    if (jsonText.includes(variant)) {
      return true;
    }

    const tokens = meaningfulTokens(variant);
    const hasEnoughTokens = tokens.length >= 2 || variant.length >= 12;

    if (hasEnoughTokens && tokens.every(token => jsonText.includes(token))) {
      return true;
    }

    if (
      tokens.length === 1 &&
      /^(bilingual|elementary|full|limited|native|professional|working)$/.test(
        tokens[0]
      ) &&
      jsonText.includes(tokens[0])
    ) {
      return true;
    }
  }

  return false;
}

function lineRepresentedInJson(line, jsonText) {
  const columnSegments = line
    .split(/\s{2,}/)
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);

  if (columnSegments.length > 1) {
    return columnSegments.every(
      segment =>
        ignoredRawLine(segment) || segmentRepresentedInJson(segment, jsonText)
    );
  }

  return segmentRepresentedInJson(line, jsonText);
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
  const rawLines = layoutText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => !ignoredRawLine(line));
  const jsonPath = path.join(samplesDir, jsonFileName(pdfFileName));
  const parsedJson = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const jsonText = searchableJsonText(parsedJson);
  const unmatchedLines = rawLines.filter(
    line => !lineRepresentedInJson(line, jsonText)
  );

  fileReports.push({
    pdfFileName,
    rawLineCount: rawLines.length,
    unmatchedLineCount: unmatchedLines.length,
    unmatchedLines,
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
  totalSectionWarningCount,
  files: fileReports,
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  [
    `Audited ${fileReports.length} sample PDF/JSON pair(s).`,
    `Raw non-heading lines: ${totalRawLineCount}.`,
    `Heuristic unmatched lines: ${totalUnmatchedLineCount}.`,
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
