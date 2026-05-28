#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  ensureRegularFile,
  formatBytes,
  repoPath,
} from './lib/verification-helpers.mjs';

export const defaultBundleArtifacts = [
  'dist/index.js',
  'dist/index.cjs',
  'dist/index.min.js',
  'dist/cli.js',
];

const topLevelJavaScriptArtifactPattern = /^[^/\\]+\.(?:cjs|js)$/;

export function isTopLevelJavaScriptArtifactFileName(fileName) {
  return topLevelJavaScriptArtifactPattern.test(fileName);
}

export function readBundleArtifact(
  relativePath,
  {
    ensureFile = ensureRegularFile,
    gzip = gzipSync,
    readFile = readFileSync,
  } = {}
) {
  const file = ensureFile(relativePath);
  const gzipBytes = gzip(readFile(file.absolutePath)).length;

  return {
    ...file,
    gzipBytes,
  };
}

export function listTopLevelDistFileNames({
  readDirectory = readdirSync,
  resolveRepoPath = repoPath,
} = {}) {
  return readDirectory(resolveRepoPath('dist')).filter(
    isTopLevelJavaScriptArtifactFileName
  );
}

export function getBundleFileSize(
  relativePath,
  { ensureFile = ensureRegularFile } = {}
) {
  return ensureFile(relativePath).size;
}

export function measureBundleSizes({
  bundleArtifacts = defaultBundleArtifacts,
  getFileSize = getBundleFileSize,
  listDistFileNames = listTopLevelDistFileNames,
  readArtifact = readBundleArtifact,
} = {}) {
  const artifacts = bundleArtifacts.map(readArtifact);
  const totalTopLevelJavaScriptBytes = listDistFileNames()
    .filter(isTopLevelJavaScriptArtifactFileName)
    .reduce(
      (totalBytes, fileName) => totalBytes + getFileSize(`dist/${fileName}`),
      0
    );

  return {
    artifacts,
    totalTopLevelJavaScriptBytes,
  };
}

export function formatBundleSizeReport(report) {
  const lines = ['Bundle artifact sizes:'];

  for (const artifact of report.artifacts) {
    lines.push(
      `${artifact.relativePath}: ${formatBytes(
        artifact.size
      )} raw, ${formatBytes(artifact.gzipBytes)} gzip`
    );
  }

  lines.push(
    `Top-level dist JavaScript: ${formatBytes(
      report.totalTopLevelJavaScriptBytes
    )} raw`
  );

  return lines.join('\n');
}

export function runBundleSizeReportCli({
  exit = code => process.exit(code),
  formatReport = formatBundleSizeReport,
  measure = measureBundleSizes,
  writeError = message => console.error(message),
  writeOutput = message => console.log(message),
} = {}) {
  try {
    writeOutput(formatReport(measure()));
  } catch (error) {
    writeError(error instanceof Error ? error.message : error);
    exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBundleSizeReportCli();
}
