import * as path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { ParseOptions, ParseResult } from './index.js';

export type JsonOutputFormat = 'pretty' | 'compact';
type JsonFixtureExitCode = 0 | 1;

export interface JsonFixtureDirectoryEntry {
  kind: 'directory' | 'file' | 'other';
  name: string;
}

export interface JsonFixtureDependencies {
  directoryExists: (directoryPath: string) => boolean;
  fileExists: (filePath: string) => boolean;
  listDirectory: (directoryPath: string) => JsonFixtureDirectoryEntry[];
  parsePdf: (input: Uint8Array, options: ParseOptions) => Promise<ParseResult>;
  readFile: (filePath: string) => Uint8Array;
  readTextFile: (filePath: string) => string;
  resolvePath: (filePath: string) => string;
  writeTextFile: (filePath: string, content: string) => void;
}

export interface JsonFixtureResult {
  exitCode: JsonFixtureExitCode;
  stderr: string;
  stdout: string;
}

export interface WriteJsonFixturesParams {
  dependencies: JsonFixtureDependencies;
  folderPath: string;
  includeRawText: boolean;
  outputFormat: JsonOutputFormat;
  overwriteExisting: boolean;
}

export interface VerifyJsonFixturesParams {
  dependencies: JsonFixtureDependencies;
  folderPath: string;
  includeRawText: boolean;
}

interface BatchFailure {
  details?: string;
  filePath: string;
  message: string;
}

interface MatchedPair {
  jsonPath: string;
  pdfPath: string;
}

interface MatchedPairs {
  missingJsonFailures: BatchFailure[];
  missingPdfFailures: BatchFailure[];
  pairs: MatchedPair[];
}

interface ParsePdfFileParams {
  dependencies: JsonFixtureDependencies;
  includeRawText: boolean;
  pdfPath: string;
}

interface ResolvedDirectory {
  kind: 'valid';
  path: string;
}

interface InvalidDirectory {
  kind: 'invalid';
  result: JsonFixtureResult;
}

interface ResolvedFolderFiles {
  folderPath: string;
  jsonEntries: JsonFixtureDirectoryEntry[];
  kind: 'valid';
  pdfEntries: JsonFixtureDirectoryEntry[];
}

export async function writeJsonFixtures({
  dependencies,
  folderPath,
  includeRawText,
  outputFormat,
  overwriteExisting,
}: WriteJsonFixturesParams): Promise<JsonFixtureResult> {
  const folderFiles = resolveFolderFiles(folderPath, dependencies);

  if (folderFiles.kind === 'invalid') {
    return folderFiles.result;
  }

  const failures: BatchFailure[] = [];
  const writtenFiles: string[] = [];

  for (const pdfEntry of folderFiles.pdfEntries) {
    const pdfPath = path.join(folderFiles.folderPath, pdfEntry.name);
    const existingJsonEntry = findMatchingStemEntry(
      pdfEntry.name,
      folderFiles.jsonEntries
    );
    const outputJsonName =
      existingJsonEntry?.name ?? replaceExtension(pdfEntry.name, '.json');
    const outputJsonPath = path.join(folderFiles.folderPath, outputJsonName);

    if (existingJsonEntry && !overwriteExisting) {
      failures.push({
        filePath: pdfPath,
        message: `JSON already exists: ${outputJsonPath}`,
      });
      continue;
    }

    try {
      const result = await parsePdfFile({
        dependencies,
        includeRawText,
        pdfPath,
      });

      dependencies.writeTextFile(
        outputJsonPath,
        `${formatJson(result, outputFormat)}\n`
      );
      writtenFiles.push(outputJsonPath);
    } catch (error) {
      failures.push({
        filePath: pdfPath,
        message: formatErrorMessage(error),
      });
    }
  }

  return {
    exitCode: failures.length === 0 ? 0 : 1,
    stderr: formatBatchFailures('Failed to write JSON for files', failures),
    stdout: formatWrittenFiles(folderFiles.folderPath, writtenFiles),
  };
}

export async function verifyJsonFixtures({
  dependencies,
  folderPath,
  includeRawText,
}: VerifyJsonFixturesParams): Promise<JsonFixtureResult> {
  const folderFiles = resolveFolderFiles(folderPath, dependencies);

  if (folderFiles.kind === 'invalid') {
    return folderFiles.result;
  }

  const matchedPairs = createMatchedPairs(
    folderFiles.folderPath,
    folderFiles.pdfEntries,
    folderFiles.jsonEntries
  );
  const failures = [
    ...matchedPairs.missingJsonFailures,
    ...matchedPairs.missingPdfFailures,
  ];
  const passedFiles: string[] = [];

  if (matchedPairs.pairs.length === 0 && failures.length === 0) {
    return {
      exitCode: 1,
      stderr: `Error: No matching PDF/JSON pairs found in ${folderFiles.folderPath}\n`,
      stdout: '',
    };
  }

  for (const pair of matchedPairs.pairs) {
    let expectedJson: unknown;

    try {
      expectedJson = JSON.parse(dependencies.readTextFile(pair.jsonPath));
    } catch (error) {
      failures.push({
        filePath: pair.jsonPath,
        message: `Invalid JSON baseline: ${formatErrorMessage(error)}`,
      });
      continue;
    }

    try {
      const generatedJson = normalizeJsonValue(
        await parsePdfFile({
          dependencies,
          includeRawText,
          pdfPath: pair.pdfPath,
        })
      );

      if (isDeepStrictEqual(expectedJson, generatedJson)) {
        passedFiles.push(pair.pdfPath);
        continue;
      }

      failures.push({
        details: formatJsonDiff(expectedJson, generatedJson),
        filePath: pair.pdfPath,
        message: `Generated JSON differs from ${pair.jsonPath}`,
      });
    } catch (error) {
      failures.push({
        filePath: pair.pdfPath,
        message: formatErrorMessage(error),
      });
    }
  }

  return {
    exitCode: failures.length === 0 ? 0 : 1,
    stderr: formatBatchFailures('Verification failed for files', failures),
    stdout: formatVerifiedFiles(folderFiles.folderPath, passedFiles),
  };
}

export function formatJson(
  result: ParseResult,
  outputFormat: JsonOutputFormat
): string {
  return outputFormat === 'pretty'
    ? JSON.stringify(result, null, 2)
    : JSON.stringify(result);
}

export function hasFileExtension(filePath: string, extension: string): boolean {
  return filePath.toLowerCase().endsWith(extension);
}

export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function parsePdfFile({
  dependencies,
  includeRawText,
  pdfPath,
}: ParsePdfFileParams): Promise<ParseResult> {
  return dependencies.parsePdf(dependencies.readFile(pdfPath), {
    includeRawText,
  });
}

function resolveDirectory(
  folderPath: string,
  dependencies: JsonFixtureDependencies
): InvalidDirectory | ResolvedDirectory {
  const resolvedPath = dependencies.resolvePath(folderPath);

  if (dependencies.directoryExists(resolvedPath)) {
    return {
      kind: 'valid',
      path: resolvedPath,
    };
  }

  if (dependencies.fileExists(resolvedPath)) {
    return {
      kind: 'invalid',
      result: {
        exitCode: 1,
        stderr: `Error: Path must be a directory: ${resolvedPath}\n`,
        stdout: '',
      },
    };
  }

  return {
    kind: 'invalid',
    result: {
      exitCode: 1,
      stderr: `Error: Directory not found: ${resolvedPath}\n`,
      stdout: '',
    },
  };
}

function resolveFolderFiles(
  folderPath: string,
  dependencies: JsonFixtureDependencies
): InvalidDirectory | ResolvedFolderFiles {
  const folder = resolveDirectory(folderPath, dependencies);

  if (folder.kind === 'invalid') {
    return folder;
  }

  const entries = dependencies.listDirectory(folder.path);

  return {
    folderPath: folder.path,
    jsonEntries: listFilesByExtension(entries, '.json'),
    kind: 'valid',
    pdfEntries: listFilesByExtension(entries, '.pdf'),
  };
}

function listFilesByExtension(
  entries: JsonFixtureDirectoryEntry[],
  extension: string
): JsonFixtureDirectoryEntry[] {
  return entries
    .filter(
      entry => entry.kind === 'file' && hasFileExtension(entry.name, extension)
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

function createMatchedPairs(
  folderPath: string,
  pdfEntries: JsonFixtureDirectoryEntry[],
  jsonEntries: JsonFixtureDirectoryEntry[]
): MatchedPairs {
  const pairs: MatchedPair[] = [];
  const missingJsonFailures: BatchFailure[] = [];
  const matchedJsonNames = new Set<string>();

  for (const pdfEntry of pdfEntries) {
    const jsonEntry = findMatchingStemEntry(pdfEntry.name, jsonEntries);
    const pdfPath = path.join(folderPath, pdfEntry.name);

    if (!jsonEntry) {
      missingJsonFailures.push({
        filePath: pdfPath,
        message: `Missing JSON baseline: ${path.join(
          folderPath,
          replaceExtension(pdfEntry.name, '.json')
        )}`,
      });
      continue;
    }

    matchedJsonNames.add(jsonEntry.name);
    pairs.push({
      jsonPath: path.join(folderPath, jsonEntry.name),
      pdfPath,
    });
  }

  const missingPdfFailures = jsonEntries
    .filter(jsonEntry => !matchedJsonNames.has(jsonEntry.name))
    .map(jsonEntry => ({
      filePath: path.join(folderPath, jsonEntry.name),
      message: `Missing PDF source: ${path.join(
        folderPath,
        replaceExtension(jsonEntry.name, '.pdf')
      )}`,
    }));

  return {
    missingJsonFailures,
    missingPdfFailures,
    pairs,
  };
}

function findMatchingStemEntry(
  fileName: string,
  entries: JsonFixtureDirectoryEntry[]
): JsonFixtureDirectoryEntry | undefined {
  const stem = getFileStem(fileName).toLowerCase();

  return entries.find(entry => getFileStem(entry.name).toLowerCase() === stem);
}

function formatWrittenFiles(
  folderPath: string,
  writtenFiles: string[]
): string {
  const lines = [
    `Wrote ${writtenFiles.length} JSON file(s) in ${folderPath}.`,
    ...writtenFiles.map(filePath => `- ${filePath}`),
  ];

  return `${lines.join('\n')}\n`;
}

function formatVerifiedFiles(
  folderPath: string,
  passedFiles: string[]
): string {
  const lines = [
    `Verified ${passedFiles.length} PDF/JSON pair(s) in ${folderPath}.`,
    ...passedFiles.map(filePath => `- ${filePath}`),
  ];

  return `${lines.join('\n')}\n`;
}

function formatBatchFailures(header: string, failures: BatchFailure[]): string {
  if (failures.length === 0) {
    return '';
  }

  return `${[
    `${header}:`,
    ...failures.flatMap(failure => [
      `- ${failure.filePath}: ${failure.message}`,
      ...(failure.details ? [failure.details] : []),
    ]),
  ].join('\n')}\n`;
}

function formatJsonDiff(expectedJson: unknown, generatedJson: unknown): string {
  const expectedLines = formatUnknownJson(expectedJson).split('\n');
  const generatedLines = formatUnknownJson(generatedJson).split('\n');
  const lineCount = Math.max(expectedLines.length, generatedLines.length);
  const diffLines = ['--- expected', '+++ generated'];

  for (let index = 0; index < lineCount; index += 1) {
    const expectedLine = expectedLines[index];
    const generatedLine = generatedLines[index];

    if (expectedLine === generatedLine && expectedLine !== undefined) {
      diffLines.push(`  ${expectedLine}`);
      continue;
    }

    if (expectedLine !== undefined) {
      diffLines.push(`- ${expectedLine}`);
    }

    if (generatedLine !== undefined) {
      diffLines.push(`+ ${generatedLine}`);
    }
  }

  return diffLines.join('\n');
}

function formatUnknownJson(value: unknown): string {
  const formattedJson = JSON.stringify(value, null, 2);

  return typeof formattedJson === 'string' ? formattedJson : String(value);
}

function normalizeJsonValue(value: ParseResult): unknown {
  return JSON.parse(JSON.stringify(value));
}

function replaceExtension(fileName: string, extension: string): string {
  return `${getFileStem(fileName)}${extension}`;
}

function getFileStem(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf('.');

  return extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex);
}
