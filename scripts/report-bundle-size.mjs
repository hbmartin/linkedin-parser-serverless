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

export function readBundleArtifact(relativePath) {
  const file = ensureRegularFile(relativePath);
  const gzipBytes = gzipSync(readFileSync(file.absolutePath)).length;

  return {
    ...file,
    gzipBytes,
  };
}

export function listTopLevelDistFileNames() {
  return readdirSync(repoPath('dist'));
}

export function measureBundleSizes({
  bundleArtifacts = defaultBundleArtifacts,
  listDistFileNames = listTopLevelDistFileNames,
  readArtifact = readBundleArtifact,
} = {}) {
  const artifacts = bundleArtifacts.map(readArtifact);
  const totalTopLevelJavaScriptBytes = listDistFileNames()
    .filter(fileName => /\.(?:cjs|js)$/.test(fileName))
    .reduce(
      (totalBytes, fileName) =>
        totalBytes + readArtifact(`dist/${fileName}`).size,
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

function main() {
  console.log(formatBundleSizeReport(measureBundleSizes()));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
