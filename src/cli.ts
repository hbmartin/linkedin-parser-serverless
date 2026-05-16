import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseLinkedInPDF, type ParseResult } from './index.js';
import {
  formatErrorMessage,
  formatJson,
  hasFileExtension,
  verifyJsonFixtures,
  writeJsonFixtures,
  type JsonFixtureDependencies,
  type JsonFixtureDirectoryEntry,
  type JsonOutputFormat,
} from './json-fixtures.js';
import { getNodeDirectoryEntryKind } from './node-directory-entry.js';

type CliExitCode = 0 | 1;

export type CliDirectoryEntry = JsonFixtureDirectoryEntry;

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

export interface CliDependencies extends JsonFixtureDependencies {}

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
      kind: getNodeDirectoryEntryKind(directoryPath, entry),
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
      stderr: '',
      stdout: usageText,
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
): Promise<CliExitCode> {
  const result = await runCli({ args });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result.exitCode;
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
  return writeJsonFixtures({
    dependencies,
    folderPath: command.folderPath,
    includeRawText: command.includeRawText,
    outputFormat: command.outputFormat,
    overwriteExisting: command.overwriteExisting,
  });
}

async function runVerifyJsonCommand(
  command: VerifyJsonCommand,
  dependencies: CliDependencies
): Promise<CliResult> {
  return verifyJsonFixtures({
    dependencies,
    folderPath: command.folderPath,
    includeRawText: command.includeRawText,
  });
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

interface ParsePdfFileParams {
  dependencies: CliDependencies;
  includeRawText: boolean;
  pdfPath: string;
}
