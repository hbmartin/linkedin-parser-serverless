import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  assertCondition,
  ensureRegularFile,
  formatBytes,
  repoPath,
} from './lib/verification-helpers.mjs';

export const fileBudgets = [
  {
    file: 'dist/index.js',
    gzipBytes: 100 * 1024,
    rawBytes: 256 * 1024,
  },
  {
    file: 'dist/index.cjs',
    gzipBytes: 100 * 1024,
    rawBytes: 256 * 1024,
  },
  {
    file: 'dist/index.min.js',
    gzipBytes: 30 * 1024,
    rawBytes: 100 * 1024,
  },
  {
    file: 'dist/cli.js',
    gzipBytes: 5 * 1024,
    rawBytes: 20 * 1024,
  },
];
export const totalTopLevelJavaScriptBudget = 632 * 1024;

function main() {
  const results = fileBudgets.map(budget => {
    const file = ensureRegularFile(budget.file);
    const gzipBytes = gzipSync(readFileSync(file.absolutePath)).length;

    assertCondition(
      file.size <= budget.rawBytes,
      `${budget.file} is ${formatBytes(file.size)}, above raw budget ${formatBytes(
        budget.rawBytes
      )}`
    );
    assertCondition(
      gzipBytes <= budget.gzipBytes,
      `${budget.file} is ${formatBytes(
        gzipBytes
      )} gzipped, above gzip budget ${formatBytes(budget.gzipBytes)}`
    );

    return {
      ...file,
      gzipBytes,
    };
  });

  const indexFile = results.find(
    result => result.relativePath === 'dist/index.js'
  );
  const minifiedFile = results.find(
    result => result.relativePath === 'dist/index.min.js'
  );

  assertCondition(indexFile !== undefined, 'Missing dist/index.js size result');
  assertCondition(
    minifiedFile !== undefined,
    'Missing dist/index.min.js size result'
  );
  assertCondition(
    minifiedFile.size < indexFile.size,
    'dist/index.min.js must be smaller than dist/index.js'
  );

  const totalTopLevelJavaScriptBytes = readdirSync(repoPath('dist'))
    .filter(fileName => /\.(?:cjs|js)$/.test(fileName))
    .reduce(
      (totalBytes, fileName) =>
        totalBytes + ensureRegularFile(`dist/${fileName}`).size,
      0
    );

  assertCondition(
    totalTopLevelJavaScriptBytes <= totalTopLevelJavaScriptBudget,
    `Top-level dist JavaScript is ${formatBytes(
      totalTopLevelJavaScriptBytes
    )}, above budget ${formatBytes(totalTopLevelJavaScriptBudget)}`
  );

  for (const result of results) {
    console.log(
      `${result.relativePath}: ${formatBytes(result.size)} raw, ${formatBytes(
        result.gzipBytes
      )} gzip`
    );
  }
  console.log(
    `Top-level dist JavaScript: ${formatBytes(totalTopLevelJavaScriptBytes)} raw`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
