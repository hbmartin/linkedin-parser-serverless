import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

export function repoPath(...segments) {
  return resolve(repoRoot, ...segments);
}

export function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function ensureRegularFile(relativePath) {
  const absolutePath = repoPath(relativePath);

  assertCondition(
    existsSync(absolutePath),
    `Missing expected file: ${relativePath}`
  );

  const stats = statSync(absolutePath);
  assertCondition(stats.isFile(), `Expected a file at: ${relativePath}`);
  assertCondition(
    stats.size > 0,
    `Expected a non-empty file at: ${relativePath}`
  );

  return {
    absolutePath,
    relativePath,
    size: stats.size,
  };
}

export function formatBytes(byteCount) {
  if (byteCount < 1024) {
    return `${byteCount} B`;
  }

  return `${(byteCount / 1024).toFixed(2)} KiB`;
}

export function runCommand({ command, args, cwd = repoRoot, env = {} }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const renderedCommand = [command, ...args].join(' ');
    throw new Error(
      [
        `Command failed: ${renderedCommand}`,
        `Exit status: ${result.status ?? 'unknown'}`,
        result.stdout ? `stdout:\n${result.stdout}` : undefined,
        result.stderr ? `stderr:\n${result.stderr}` : undefined,
      ]
        .filter(Boolean)
        .join('\n\n')
    );
  }

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

export function executablePath(packageBinPath) {
  return process.platform === 'win32'
    ? `${packageBinPath}.cmd`
    : packageBinPath;
}
