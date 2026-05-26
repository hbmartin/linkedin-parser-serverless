import * as path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { ParseOptions, ParseResult } from './index.js';

export type JsonOutputFormat = 'pretty' | 'compact';
export type JsonDiffOutputFormat = 'context' | 'json-paths';
type JsonFixtureExitCode = 0 | 1;
const JSON_DIFF_CONTEXT_LINE_COUNT = 3;

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
  diffOutputFormat?: JsonDiffOutputFormat;
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

interface ContextDiffEntry {
  generatedLineNumber?: number;
  kind: 'context' | 'generated' | 'expected';
  line: string;
  expectedLineNumber?: number;
}

interface ContextDiffHunk {
  endIndex: number;
  startIndex: number;
}

interface AddedJsonValueChange {
  kind: 'added';
  path: JsonPathSegment[];
  value: unknown;
}

interface ChangedJsonValueChange {
  generatedValue: unknown;
  expectedValue: unknown;
  kind: 'changed';
  path: JsonPathSegment[];
}

interface RemovedJsonValueChange {
  kind: 'removed';
  path: JsonPathSegment[];
  value: unknown;
}

type JsonValueChange =
  | AddedJsonValueChange
  | ChangedJsonValueChange
  | RemovedJsonValueChange;

type JsonPathSegment =
  | {
      index: number;
      kind: 'array-index';
    }
  | {
      key: string;
      kind: 'object-key';
    };

interface JsonRecord {
  [key: string]: unknown;
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
  diffOutputFormat = 'context',
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
      expectedJson = normalizeJsonValue(
        JSON.parse(dependencies.readTextFile(pair.jsonPath))
      );
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
        details: formatJsonDiff(expectedJson, generatedJson, diffOutputFormat),
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

function formatJsonDiff(
  expectedJson: unknown,
  generatedJson: unknown,
  diffOutputFormat: JsonDiffOutputFormat
): string {
  return diffOutputFormat === 'json-paths'
    ? formatJsonPathDiff(expectedJson, generatedJson)
    : formatContextJsonDiff(expectedJson, generatedJson);
}

// Compare canonical JSON text so CLI mismatches stay stable and dependency-light.
function formatContextJsonDiff(
  expectedJson: unknown,
  generatedJson: unknown
): string {
  const expectedLines = formatUnknownJson(expectedJson).split('\n');
  const generatedLines = formatUnknownJson(generatedJson).split('\n');
  const diffEntries = createContextDiffEntries(expectedLines, generatedLines);
  const hunks = createContextDiffHunks(diffEntries);
  const diffLines = ['--- expected', '+++ generated'];

  for (const hunk of hunks) {
    const hunkEntries = diffEntries.slice(hunk.startIndex, hunk.endIndex + 1);
    diffLines.push(formatContextDiffHunkHeader(hunkEntries));

    for (const entry of hunkEntries) {
      diffLines.push(formatContextDiffEntry(entry));
    }
  }

  return diffLines.join('\n');
}

function createContextDiffEntries(
  expectedLines: string[],
  generatedLines: string[]
): ContextDiffEntry[] {
  const lcsTable = createLongestCommonSubsequenceTable(
    expectedLines,
    generatedLines
  );
  const entries: ContextDiffEntry[] = [];
  let expectedIndex = 0;
  let generatedIndex = 0;

  while (
    expectedIndex < expectedLines.length &&
    generatedIndex < generatedLines.length
  ) {
    const expectedLine = expectedLines[expectedIndex];
    const generatedLine = generatedLines[generatedIndex];

    if (expectedLine === generatedLine) {
      entries.push({
        generatedLineNumber: generatedIndex + 1,
        kind: 'context',
        line: expectedLine,
        expectedLineNumber: expectedIndex + 1,
      });
      expectedIndex += 1;
      generatedIndex += 1;
      continue;
    }

    if (
      lcsTable[expectedIndex + 1][generatedIndex] >=
      lcsTable[expectedIndex][generatedIndex + 1]
    ) {
      entries.push({
        kind: 'expected',
        line: expectedLine,
        expectedLineNumber: expectedIndex + 1,
      });
      expectedIndex += 1;
      continue;
    }

    entries.push({
      generatedLineNumber: generatedIndex + 1,
      kind: 'generated',
      line: generatedLine,
    });
    generatedIndex += 1;
  }

  while (expectedIndex < expectedLines.length) {
    entries.push({
      kind: 'expected',
      line: expectedLines[expectedIndex],
      expectedLineNumber: expectedIndex + 1,
    });
    expectedIndex += 1;
  }

  while (generatedIndex < generatedLines.length) {
    entries.push({
      generatedLineNumber: generatedIndex + 1,
      kind: 'generated',
      line: generatedLines[generatedIndex],
    });
    generatedIndex += 1;
  }

  return entries;
}

function createLongestCommonSubsequenceTable(
  expectedLines: string[],
  generatedLines: string[]
): number[][] {
  const table = Array.from({ length: expectedLines.length + 1 }, () =>
    Array<number>(generatedLines.length + 1).fill(0)
  );

  for (
    let expectedIndex = expectedLines.length - 1;
    expectedIndex >= 0;
    expectedIndex -= 1
  ) {
    for (
      let generatedIndex = generatedLines.length - 1;
      generatedIndex >= 0;
      generatedIndex -= 1
    ) {
      table[expectedIndex][generatedIndex] =
        expectedLines[expectedIndex] === generatedLines[generatedIndex]
          ? table[expectedIndex + 1][generatedIndex + 1] + 1
          : Math.max(
              table[expectedIndex + 1][generatedIndex],
              table[expectedIndex][generatedIndex + 1]
            );
    }
  }

  return table;
}

function createContextDiffHunks(
  diffEntries: ContextDiffEntry[]
): ContextDiffHunk[] {
  const changeIndexes = diffEntries
    .map((entry, index) => (entry.kind === 'context' ? -1 : index))
    .filter(index => index !== -1);
  const hunks: ContextDiffHunk[] = [];

  for (const changeIndex of changeIndexes) {
    const startIndex = Math.max(changeIndex - JSON_DIFF_CONTEXT_LINE_COUNT, 0);
    const endIndex = Math.min(
      changeIndex + JSON_DIFF_CONTEXT_LINE_COUNT,
      diffEntries.length - 1
    );
    const previousHunk = hunks[hunks.length - 1];

    if (previousHunk && startIndex <= previousHunk.endIndex + 1) {
      previousHunk.endIndex = Math.max(previousHunk.endIndex, endIndex);
      continue;
    }

    hunks.push({
      endIndex,
      startIndex,
    });
  }

  return hunks;
}

function formatContextDiffHunkHeader(entries: ContextDiffEntry[]): string {
  const expectedLineNumbers = entries.flatMap(entry =>
    entry.expectedLineNumber === undefined ? [] : [entry.expectedLineNumber]
  );
  const generatedLineNumbers = entries.flatMap(entry =>
    entry.generatedLineNumber === undefined ? [] : [entry.generatedLineNumber]
  );
  const expectedStartLine = expectedLineNumbers[0] ?? 0;
  const generatedStartLine = generatedLineNumbers[0] ?? 0;

  return `@@ -${formatContextDiffRange(expectedStartLine, expectedLineNumbers.length)} +${formatContextDiffRange(generatedStartLine, generatedLineNumbers.length)} @@`;
}

function formatContextDiffRange(startLine: number, lineCount: number): string {
  return lineCount === 1 ? String(startLine) : `${startLine},${lineCount}`;
}

function formatContextDiffEntry(entry: ContextDiffEntry): string {
  if (entry.kind === 'expected') {
    return `-${entry.line}`;
  }

  if (entry.kind === 'generated') {
    return `+${entry.line}`;
  }

  return ` ${entry.line}`;
}

function formatJsonPathDiff(
  expectedJson: unknown,
  generatedJson: unknown
): string {
  const changes = collectJsonValueChanges(expectedJson, generatedJson, []);

  return changes.map(formatJsonValueChange).join('\n');
}

function collectJsonValueChanges(
  expectedValue: unknown,
  generatedValue: unknown,
  pathSegments: JsonPathSegment[]
): JsonValueChange[] {
  if (isDeepStrictEqual(expectedValue, generatedValue)) {
    return [];
  }

  if (isUnknownArray(expectedValue) && isUnknownArray(generatedValue)) {
    return collectArrayValueChanges(
      expectedValue,
      generatedValue,
      pathSegments
    );
  }

  if (isJsonRecord(expectedValue) && isJsonRecord(generatedValue)) {
    return collectRecordValueChanges(
      expectedValue,
      generatedValue,
      pathSegments
    );
  }

  return [
    {
      expectedValue,
      generatedValue,
      kind: 'changed',
      path: pathSegments,
    },
  ];
}

function collectArrayValueChanges(
  expectedValues: ReadonlyArray<unknown>,
  generatedValues: ReadonlyArray<unknown>,
  pathSegments: JsonPathSegment[]
): JsonValueChange[] {
  const changes: JsonValueChange[] = [];
  const sharedLength = Math.min(expectedValues.length, generatedValues.length);

  for (let index = 0; index < sharedLength; index += 1) {
    changes.push(
      ...collectJsonValueChanges(
        expectedValues[index],
        generatedValues[index],
        appendArrayIndexPathSegment(pathSegments, index)
      )
    );
  }

  for (let index = sharedLength; index < expectedValues.length; index += 1) {
    changes.push(
      ...collectRemovedJsonValueChanges(
        expectedValues[index],
        appendArrayIndexPathSegment(pathSegments, index)
      )
    );
  }

  for (let index = sharedLength; index < generatedValues.length; index += 1) {
    changes.push(
      ...collectAddedJsonValueChanges(
        generatedValues[index],
        appendArrayIndexPathSegment(pathSegments, index)
      )
    );
  }

  return changes;
}

function collectRecordValueChanges(
  expectedRecord: JsonRecord,
  generatedRecord: JsonRecord,
  pathSegments: JsonPathSegment[]
): JsonValueChange[] {
  const changes: JsonValueChange[] = [];
  const expectedKeys = Object.keys(expectedRecord);
  const generatedKeys = Object.keys(generatedRecord);
  const orderedKeys = [
    ...expectedKeys,
    ...generatedKeys.filter(key => !Object.hasOwn(expectedRecord, key)),
  ];

  for (const key of orderedKeys) {
    const childPathSegments = appendObjectKeyPathSegment(pathSegments, key);

    if (!Object.hasOwn(generatedRecord, key)) {
      changes.push(
        ...collectRemovedJsonValueChanges(
          expectedRecord[key],
          childPathSegments
        )
      );
      continue;
    }

    if (!Object.hasOwn(expectedRecord, key)) {
      changes.push(
        ...collectAddedJsonValueChanges(generatedRecord[key], childPathSegments)
      );
      continue;
    }

    changes.push(
      ...collectJsonValueChanges(
        expectedRecord[key],
        generatedRecord[key],
        childPathSegments
      )
    );
  }

  return changes;
}

function collectAddedJsonValueChanges(
  value: unknown,
  pathSegments: JsonPathSegment[]
): JsonValueChange[] {
  if (isUnknownArray(value) && value.length > 0) {
    return value.flatMap((childValue, index) =>
      collectAddedJsonValueChanges(
        childValue,
        appendArrayIndexPathSegment(pathSegments, index)
      )
    );
  }

  if (isJsonRecord(value)) {
    const keys = Object.keys(value);

    if (keys.length > 0) {
      return keys.flatMap(key =>
        collectAddedJsonValueChanges(
          value[key],
          appendObjectKeyPathSegment(pathSegments, key)
        )
      );
    }
  }

  return [
    {
      kind: 'added',
      path: pathSegments,
      value,
    },
  ];
}

function collectRemovedJsonValueChanges(
  value: unknown,
  pathSegments: JsonPathSegment[]
): JsonValueChange[] {
  if (isUnknownArray(value) && value.length > 0) {
    return value.flatMap((childValue, index) =>
      collectRemovedJsonValueChanges(
        childValue,
        appendArrayIndexPathSegment(pathSegments, index)
      )
    );
  }

  if (isJsonRecord(value)) {
    const keys = Object.keys(value);

    if (keys.length > 0) {
      return keys.flatMap(key =>
        collectRemovedJsonValueChanges(
          value[key],
          appendObjectKeyPathSegment(pathSegments, key)
        )
      );
    }
  }

  return [
    {
      kind: 'removed',
      path: pathSegments,
      value,
    },
  ];
}

function appendArrayIndexPathSegment(
  pathSegments: JsonPathSegment[],
  index: number
): JsonPathSegment[] {
  return [
    ...pathSegments,
    {
      index,
      kind: 'array-index',
    },
  ];
}

function appendObjectKeyPathSegment(
  pathSegments: JsonPathSegment[],
  key: string
): JsonPathSegment[] {
  return [
    ...pathSegments,
    {
      key,
      kind: 'object-key',
    },
  ];
}

function formatJsonValueChange(change: JsonValueChange): string {
  const path = formatJsonPath(change.path);

  if (change.kind === 'added') {
    return `+ ${path}: ${formatInlineJson(change.value)}`;
  }

  if (change.kind === 'removed') {
    return `- ${path}: ${formatInlineJson(change.value)}`;
  }

  return `~ ${path}: ${formatInlineJson(change.expectedValue)} -> ${formatInlineJson(change.generatedValue)}`;
}

function formatJsonPath(pathSegments: JsonPathSegment[]): string {
  if (pathSegments.length === 0) {
    return '$';
  }

  return pathSegments
    .map((segment, index) => {
      if (segment.kind === 'array-index') {
        return `[${segment.index}]`;
      }

      if (!canUseDotNotationForJsonKey(segment.key)) {
        return `[${JSON.stringify(segment.key)}]`;
      }

      return index === 0 ? segment.key : `.${segment.key}`;
    })
    .join('');
}

function canUseDotNotationForJsonKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

function formatInlineJson(value: unknown): string {
  const formattedJson = JSON.stringify(value);

  return typeof formattedJson === 'string' ? formattedJson : String(value);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is ReadonlyArray<unknown> {
  return Array.isArray(value);
}

// Use the same two-space JSON form as fixture files for readable comparisons.
function formatUnknownJson(value: unknown): string {
  const formattedJson = JSON.stringify(value, null, 2);

  return typeof formattedJson === 'string' ? formattedJson : String(value);
}

// Round-trip values into plain JSON shapes before comparing baselines.
function normalizeJsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function replaceExtension(fileName: string, extension: string): string {
  return `${getFileStem(fileName)}${extension}`;
}

function getFileStem(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf('.');

  return extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex);
}
