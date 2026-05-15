import * as fs from 'fs';
import * as path from 'path';
import {
  parseLinkedInPDF,
  type ParseOptions,
  type ParseResult,
} from './index.js';
import { isDeepStrictEqual } from 'node:util';

type JsonOutputFormat = 'pretty' | 'compact';
type CliExitCode = 0 | 1;

export interface CliDirectoryEntry {
  kind: 'directory' | 'file' | 'other';
  name: string;
}

interface ParseCommand {
  kind: 'parse';
  pdfPath: string;
  includeRawText: boolean;
  outputFormat: JsonOutputFormat;
}

interface HelpCommand {
  kind: 'help';
}

interface InvalidCommand {
  kind: 'invalid';
  message: string;
}

interface WriteJsonCommand {
  kind: 'write-json';
  folderPath: string;
  includeRawText: boolean;
  outputFormat: JsonOutputFormat;
  overwriteExisting: boolean;
}

interface VerifyJsonCommand {
  kind: 'verify-json';
  folderPath: string;
  includeRawText: boolean;
}

type CliCommand =
  | HelpCommand
  | InvalidCommand
  | ParseCommand
  | VerifyJsonCommand
  | WriteJsonCommand;

export interface CliDependencies {
  directoryExists: (directoryPath: string) => boolean;
  fileExists: (filePath: string) => boolean;
  listDirectory: (directoryPath: string) => CliDirectoryEntry[];
  parsePdf: (input: Uint8Array, options: ParseOptions) => Promise<ParseResult>;
  readFile: (filePath: string) => Uint8Array;
  readTextFile: (filePath: string) => string;
  resolvePath: (filePath: string) => string;
  writeTextFile: (filePath: string, content: string) => void;
}

export interface RunCliParams {
  args: string[];
  dependencies?: CliDependencies;
}

export interface CliResult {
  exitCode: CliExitCode;
  stderr: string;
  stdout: string;
}

const usageText = `
Usage:
  linkedin-pdf-parser <pdf-file-path> [options]
  linkedin-pdf-parser write-json <folder> [--raw-text] [--compact] [--force]
  linkedin-pdf-parser verify-json <folder> [--raw-text]

Arguments:
  <pdf-file-path>     Path to the LinkedIn PDF file to parse
  <folder>            Folder containing top-level PDF/JSON baseline files

Options:
  --raw-text         Include raw extracted text in output
  --pretty           Pretty-print JSON output (default: true)
  --compact          Compact JSON output (no formatting)
  --force            Overwrite existing JSON files in write-json mode
  --help, -h         Show this help message

Examples:
  linkedin-pdf-parser ./resume.pdf
  linkedin-pdf-parser /path/to/linkedin-resume.pdf --raw-text
  linkedin-pdf-parser resume.pdf --compact
  linkedin-pdf-parser write-json ./fixtures --force
  linkedin-pdf-parser verify-json ./fixtures

Output:
  Outputs structured JSON to stdout with parsed LinkedIn profile data
  Folder modes print summaries and use exit code 1 for any failed file
`;

const nodeCliDependencies: CliDependencies = {
  directoryExists: directoryPath =>
    fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory(),
  fileExists: fs.existsSync,
  listDirectory: directoryPath =>
    fs.readdirSync(directoryPath, { withFileTypes: true }).map(entry => ({
      kind: entry.isFile()
        ? 'file'
        : entry.isDirectory()
          ? 'directory'
          : 'other',
      name: entry.name,
    })),
  parsePdf: parseLinkedInPDF,
  readFile: fs.readFileSync,
  readTextFile: filePath => fs.readFileSync(filePath, 'utf8'),
  resolvePath: path.resolve,
  writeTextFile: fs.writeFileSync,
};

export async function runCli({
  args,
  dependencies = nodeCliDependencies,
}: RunCliParams): Promise<CliResult> {
  const command = parseCliCommand(args);

  if (command.kind === 'help') {
    return {
      exitCode: 0,
      stderr: usageText,
      stdout: '',
    };
  }

  if (command.kind === 'invalid') {
    return {
      exitCode: 1,
      stderr: `Error: ${command.message}\n${usageText}`,
      stdout: '',
    };
  }

  try {
    if (command.kind === 'parse') {
      return await runParseCommand(command, dependencies);
    }

    if (command.kind === 'write-json') {
      return await runWriteJsonCommand(command, dependencies);
    }

    return await runVerifyJsonCommand(command, dependencies);
  } catch (error) {
    return {
      exitCode: 1,
      stderr: `Error: ${formatErrorMessage(error)}\n`,
      stdout: '',
    };
  }
}

export async function main(
  args: string[] = process.argv.slice(2)
): Promise<void> {
  const result = await runCli({ args });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

function parseCliCommand(args: string[]): CliCommand {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    return { kind: 'help' };
  }

  if (args[0] === 'write-json') {
    return parseWriteJsonCommand(args.slice(1));
  }

  if (args[0] === 'verify-json') {
    return parseVerifyJsonCommand(args.slice(1));
  }

  const pdfPath = args.find(arg => !arg.startsWith('--'));
  if (!pdfPath) {
    return {
      kind: 'invalid',
      message: 'No PDF file path provided',
    };
  }

  return {
    kind: 'parse',
    pdfPath,
    includeRawText: args.includes('--raw-text'),
    outputFormat: args.includes('--compact') ? 'compact' : 'pretty',
  };
}

function parseWriteJsonCommand(args: string[]): CliCommand {
  const folderPath = getSinglePositionalArg(args, 'write-json');

  if (folderPath.kind === 'invalid') {
    return folderPath;
  }

  return {
    kind: 'write-json',
    folderPath: folderPath.value,
    includeRawText: args.includes('--raw-text'),
    outputFormat: args.includes('--compact') ? 'compact' : 'pretty',
    overwriteExisting: args.includes('--force'),
  };
}

function parseVerifyJsonCommand(args: string[]): CliCommand {
  const folderPath = getSinglePositionalArg(args, 'verify-json');

  if (folderPath.kind === 'invalid') {
    return folderPath;
  }

  return {
    kind: 'verify-json',
    folderPath: folderPath.value,
    includeRawText: args.includes('--raw-text'),
  };
}

function getSinglePositionalArg(
  args: string[],
  commandName: string
): InvalidCommand | { kind: 'valid'; value: string } {
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));

  if (positionalArgs.length === 0) {
    return {
      kind: 'invalid',
      message: `No folder path provided for ${commandName}`,
    };
  }

  if (positionalArgs.length > 1) {
    return {
      kind: 'invalid',
      message: `Only one folder path may be provided for ${commandName}`,
    };
  }

  return {
    kind: 'valid',
    value: positionalArgs[0],
  };
}

async function runParseCommand(
  command: ParseCommand,
  dependencies: CliDependencies
): Promise<CliResult> {
  const resolvedPath = dependencies.resolvePath(command.pdfPath);

  if (!dependencies.fileExists(resolvedPath)) {
    return {
      exitCode: 1,
      stderr: `Error: File not found: ${resolvedPath}\n`,
      stdout: '',
    };
  }

  if (!hasFileExtension(resolvedPath, '.pdf')) {
    return {
      exitCode: 1,
      stderr: `Error: File must be a PDF: ${resolvedPath}\n`,
      stdout: '',
    };
  }

  const result = await parsePdfFile({
    dependencies,
    includeRawText: command.includeRawText,
    pdfPath: resolvedPath,
  });

  return {
    exitCode: 0,
    stderr: '',
    stdout: `${formatJson(result, command.outputFormat)}\n`,
  };
}

async function runWriteJsonCommand(
  command: WriteJsonCommand,
  dependencies: CliDependencies
): Promise<CliResult> {
  const folderFiles = resolveFolderFiles(command.folderPath, dependencies);

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

    if (existingJsonEntry && !command.overwriteExisting) {
      failures.push({
        filePath: pdfPath,
        message: `JSON already exists: ${outputJsonPath}`,
      });
      continue;
    }

    try {
      const result = await parsePdfFile({
        dependencies,
        includeRawText: command.includeRawText,
        pdfPath,
      });

      dependencies.writeTextFile(
        outputJsonPath,
        `${formatJson(result, command.outputFormat)}\n`
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

async function runVerifyJsonCommand(
  command: VerifyJsonCommand,
  dependencies: CliDependencies
): Promise<CliResult> {
  const folderFiles = resolveFolderFiles(command.folderPath, dependencies);

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
      const generatedJson = await parsePdfFile({
        dependencies,
        includeRawText: command.includeRawText,
        pdfPath: pair.pdfPath,
      });

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

async function parsePdfFile({
  dependencies,
  includeRawText,
  pdfPath,
}: ParsePdfFileParams): Promise<ParseResult> {
  return dependencies.parsePdf(dependencies.readFile(pdfPath), {
    includeRawText,
  });
}

function formatJson(
  result: ParseResult,
  outputFormat: JsonOutputFormat
): string {
  return outputFormat === 'pretty'
    ? JSON.stringify(result, null, 2)
    : JSON.stringify(result);
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
  dependencies: CliDependencies;
  includeRawText: boolean;
  pdfPath: string;
}

interface ResolvedDirectory {
  kind: 'valid';
  path: string;
}

interface InvalidDirectory {
  kind: 'invalid';
  result: CliResult;
}

interface ResolvedFolderFiles {
  folderPath: string;
  jsonEntries: CliDirectoryEntry[];
  kind: 'valid';
  pdfEntries: CliDirectoryEntry[];
}

function resolveDirectory(
  folderPath: string,
  dependencies: CliDependencies
): InvalidDirectory | ResolvedDirectory {
  const resolvedPath = dependencies.resolvePath(folderPath);

  if (!dependencies.fileExists(resolvedPath)) {
    return {
      kind: 'invalid',
      result: {
        exitCode: 1,
        stderr: `Error: Directory not found: ${resolvedPath}\n`,
        stdout: '',
      },
    };
  }

  if (!dependencies.directoryExists(resolvedPath)) {
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
    kind: 'valid',
    path: resolvedPath,
  };
}

function resolveFolderFiles(
  folderPath: string,
  dependencies: CliDependencies
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
  entries: CliDirectoryEntry[],
  extension: string
): CliDirectoryEntry[] {
  return entries
    .filter(
      entry => entry.kind === 'file' && hasFileExtension(entry.name, extension)
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

function createMatchedPairs(
  folderPath: string,
  pdfEntries: CliDirectoryEntry[],
  jsonEntries: CliDirectoryEntry[]
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
  entries: CliDirectoryEntry[]
): CliDirectoryEntry | undefined {
  const stem = getFileStem(fileName);

  return entries.find(entry => getFileStem(entry.name) === stem);
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

function hasFileExtension(filePath: string, extension: string): boolean {
  return filePath.toLowerCase().endsWith(extension);
}

function replaceExtension(fileName: string, extension: string): string {
  return `${getFileStem(fileName)}${extension}`;
}

function getFileStem(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf('.');

  return extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
