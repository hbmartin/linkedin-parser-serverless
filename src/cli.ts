import * as fs from 'fs';
import * as path from 'path';
import {
  parseLinkedInPDF,
  type ParseOptions,
  type ParseResult,
} from './index.js';

type JsonOutputFormat = 'pretty' | 'compact';
type CliExitCode = 0 | 1;

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

type CliCommand = HelpCommand | InvalidCommand | ParseCommand;

export interface CliDependencies {
  fileExists: (filePath: string) => boolean;
  parsePdf: (input: Uint8Array, options: ParseOptions) => Promise<ParseResult>;
  readFile: (filePath: string) => Uint8Array;
  resolvePath: (filePath: string) => string;
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
Usage: linkedin-pdf-parser <pdf-file-path> [options]

Arguments:
  <pdf-file-path>     Path to the LinkedIn PDF file to parse

Options:
  --raw-text         Include raw extracted text in output
  --pretty           Pretty-print JSON output (default: true)
  --compact          Compact JSON output (no formatting)
  --help, -h         Show this help message

Examples:
  linkedin-pdf-parser ./resume.pdf
  linkedin-pdf-parser /path/to/linkedin-resume.pdf --raw-text
  linkedin-pdf-parser resume.pdf --compact

Output:
  Outputs structured JSON to stdout with parsed LinkedIn profile data
`;

const nodeCliDependencies: CliDependencies = {
  fileExists: fs.existsSync,
  parsePdf: parseLinkedInPDF,
  readFile: fs.readFileSync,
  resolvePath: path.resolve,
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
    const resolvedPath = dependencies.resolvePath(command.pdfPath);

    if (!dependencies.fileExists(resolvedPath)) {
      return {
        exitCode: 1,
        stderr: `Error: File not found: ${resolvedPath}\n`,
        stdout: '',
      };
    }

    if (!resolvedPath.toLowerCase().endsWith('.pdf')) {
      return {
        exitCode: 1,
        stderr: `Error: File must be a PDF: ${resolvedPath}\n`,
        stdout: '',
      };
    }

    const result = await dependencies.parsePdf(
      dependencies.readFile(resolvedPath),
      {
        includeRawText: command.includeRawText,
      }
    );

    return {
      exitCode: 0,
      stderr: '',
      stdout: `${formatJson(result, command.outputFormat)}\n`,
    };
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

function formatJson(
  result: ParseResult,
  outputFormat: JsonOutputFormat
): string {
  return outputFormat === 'pretty'
    ? JSON.stringify(result, null, 2)
    : JSON.stringify(result);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
