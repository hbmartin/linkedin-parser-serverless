#!/usr/bin/env node
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  defaultSamplesDir,
  optionValue,
  repoRoot,
  unknownErrorMessage,
} from './lib/sample-script-helpers.mjs';

const execFileAsync = promisify(execFile);
const commandMaxBuffer = 64 * 1024 * 1024;

const nodeSampleVerificationDependencies = {
  async directoryExists(directoryPath) {
    try {
      return (await fs.stat(directoryPath)).isDirectory();
    } catch {
      return false;
    }
  },
  async listDirectory(directoryPath) {
    return (await fs.readdir(directoryPath, { withFileTypes: true })).map(
      entry => ({
        kind: entry.isFile()
          ? 'file'
          : entry.isDirectory()
            ? 'directory'
            : 'other',
        name: entry.name,
      })
    );
  },
  async runCommand({ args, command }) {
    try {
      const { stderr, stdout } = await execFileAsync(command, args, {
        cwd: repoRoot,
        maxBuffer: commandMaxBuffer,
      });

      return {
        exitCode: 0,
        stderr,
        stdout,
      };
    } catch (error) {
      return {
        exitCode: commandExitCode(error),
        stderr: commandErrorOutput(error),
        stdout: commandStdout(error),
      };
    }
  },
};

if (isCliEntrypoint()) {
  const samplesOption = optionValue('--samples');
  const result = await verifySamples({
    samplesDir: samplesOption ?? defaultSamplesDir,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exitCode = result.exitCode;
}

export async function verifySamples({
  dependencies = nodeSampleVerificationDependencies,
  samplesDir = defaultSamplesDir,
} = {}) {
  const resolvedSamplesDir = path.resolve(repoRoot, samplesDir);
  const sampleCorpus = await resolveSampleCorpus({
    dependencies,
    samplesDir: resolvedSamplesDir,
  });

  if (sampleCorpus.kind === 'invalid') {
    return sampleCorpus.result;
  }

  const samplePathArg = path.relative(repoRoot, resolvedSamplesDir) || '.';
  const stepResults = [];
  const failures = [];

  for (const step of sampleVerificationSteps(samplePathArg, sampleCorpus)) {
    const commandResult = await dependencies.runCommand({
      args: step.args,
      command: step.command,
    });
    const stepResult = {
      ...step,
      result: commandResult,
    };

    stepResults.push(stepResult);

    if (commandResult.exitCode !== 0) {
      failures.push(stepResult);

      if (step.stopOnFailure) {
        break;
      }
    }
  }

  return {
    exitCode: failures.length === 0 ? 0 : 1,
    stderr: formatFailureSummary(failures),
    stdout: formatStepResults({
      pairCount: sampleCorpus.pairCount,
      samplePathArg,
      stepResults,
    }),
  };
}

export function sampleVerificationSteps(
  samplePathArg,
  { shouldGenerateJson = false } = {}
) {
  const steps = [
    {
      args: ['run', 'build'],
      command: 'pnpm',
      label: 'Build package',
      stopOnFailure: true,
    },
  ];

  if (shouldGenerateJson) {
    steps.push({
      args: ['bin/cli.js', 'write-json', samplePathArg],
      command: 'node',
      label: 'Generate suspect sample JSON baselines',
      stopOnFailure: true,
    });
  }

  steps.push(
    {
      args: ['bin/cli.js', 'verify-json', samplePathArg],
      command: 'node',
      label: 'Verify sample JSON baselines',
      stopOnFailure: false,
    },
    {
      args: ['scripts/check-sample-warnings.mjs', '--samples', samplePathArg],
      command: 'node',
      label: 'Check sample section warnings',
      stopOnFailure: false,
    },
    {
      args: [
        'scripts/sample-completeness-audit.mjs',
        '--samples',
        samplePathArg,
        '--strict',
      ],
      command: 'node',
      label: 'Audit sample source coverage',
      stopOnFailure: false,
    }
  );

  return steps;
}

async function resolveSampleCorpus({ dependencies, samplesDir }) {
  if (!(await dependencies.directoryExists(samplesDir))) {
    return {
      kind: 'invalid',
      result: {
        exitCode: 1,
        stderr:
          [
            `Error: Sample directory not found: ${samplesDir}`,
            'The samples directory is local and gitignored; add PDF/JSON sample pairs or pass --samples <dir>.',
          ].join('\n') + '\n',
        stdout: '',
      },
    };
  }

  const entries = await dependencies.listDirectory(samplesDir);
  const pdfNames = fileNamesByExtension(entries, '.pdf');
  const jsonNames = fileNamesByExtension(entries, '.json');

  if (pdfNames.length > 0 && jsonNames.length === 0) {
    return {
      kind: 'valid',
      pairCount: pdfNames.length,
      shouldGenerateJson: true,
    };
  }

  const jsonStems = new Set(jsonNames.map(name => fileStem(name)));
  const pairCount = pdfNames.filter(name =>
    jsonStems.has(fileStem(name))
  ).length;

  if (pairCount === 0) {
    return {
      kind: 'invalid',
      result: {
        exitCode: 1,
        stderr:
          [
            `Error: No matching PDF/JSON sample pairs found in ${samplesDir}`,
            `Found ${pdfNames.length} PDF file(s) and ${jsonNames.length} JSON file(s).`,
            'The samples directory is local and gitignored; add matching top-level files such as Profile.pdf and Profile.json.',
          ].join('\n') + '\n',
        stdout: '',
      },
    };
  }

  return {
    kind: 'valid',
    pairCount,
    shouldGenerateJson: false,
  };
}

function fileNamesByExtension(entries, extension) {
  return entries
    .filter(
      entry =>
        entry.kind === 'file' && entry.name.toLowerCase().endsWith(extension)
    )
    .map(entry => entry.name);
}

function fileStem(fileName) {
  const extensionIndex = fileName.lastIndexOf('.');

  return extensionIndex === -1
    ? fileName.toLowerCase()
    : fileName.slice(0, extensionIndex).toLowerCase();
}

function formatStepResults({ pairCount, samplePathArg, stepResults }) {
  const lines = [
    `Verifying ${pairCount} local sample pair(s) in ${samplePathArg}.`,
  ];

  for (const stepResult of stepResults) {
    lines.push(
      '',
      `[samples:verify] ${stepResult.label}: ${commandLine(stepResult)}`
    );

    if (stepResult.result.stdout) {
      lines.push(stepResult.result.stdout.trimEnd());
    }

    if (stepResult.result.stderr) {
      lines.push(stepResult.result.stderr.trimEnd());
    }
  }

  if (
    stepResults.length > 0 &&
    stepResults.every(stepResult => stepResult.result.exitCode === 0)
  ) {
    lines.push('', 'Local sample verification passed.');
  }

  return `${lines.join('\n')}\n`;
}

function formatFailureSummary(failures) {
  if (failures.length === 0) {
    return '';
  }

  return `${[
    'Sample verification failed:',
    ...failures.map(
      failure =>
        `- ${failure.label} exited with code ${failure.result.exitCode}: ${commandLine(
          failure
        )}`
    ),
  ].join('\n')}\n`;
}

function commandLine({ args, command }) {
  return [command, ...args].join(' ');
}

function commandExitCode(error) {
  return error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'number'
    ? error.code
    : 1;
}

function commandStdout(error) {
  return error !== null &&
    typeof error === 'object' &&
    'stdout' in error &&
    typeof error.stdout === 'string'
    ? error.stdout
    : '';
}

function commandErrorOutput(error) {
  const stderr =
    error !== null &&
    typeof error === 'object' &&
    'stderr' in error &&
    typeof error.stderr === 'string'
      ? error.stderr
      : '';
  const message = unknownErrorMessage(error);

  return stderr.length > 0 ? stderr : `${message}\n`;
}

function isCliEntrypoint() {
  return (
    process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}
