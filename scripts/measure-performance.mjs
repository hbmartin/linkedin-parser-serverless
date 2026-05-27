#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { assertCondition, repoPath } from './lib/verification-helpers.mjs';

export const defaultInputSpecs = [
  {
    kind: 'pdf',
    path: 'tests/fixtures/Profile.pdf',
  },
  {
    kind: 'pdf',
    path: 'tests/fixtures/test_resume.pdf',
  },
  {
    kind: 'text',
    path: 'tests/fixtures/Profile.txt',
  },
  {
    kind: 'text',
    path: 'tests/fixtures/test_resume.txt',
  },
];

export const defaultBundleSpecs = [
  'dist/index.js',
  'dist/index.cjs',
  'dist/index.min.js',
  'dist/cli.js',
];

const defaultOptions = {
  iterations: 10,
  json: false,
  warmup: 3,
};

export function parseMeasurePerformanceArgs(argv) {
  const options = { ...defaultOptions };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--iterations') {
      options.iterations = parsePositiveIntegerOption(
        '--iterations',
        argv[index + 1]
      );
      index += 1;
      continue;
    }

    if (arg.startsWith('--iterations=')) {
      options.iterations = parsePositiveIntegerOption(
        '--iterations',
        arg.slice('--iterations='.length)
      );
      continue;
    }

    if (arg === '--warmup') {
      options.warmup = parsePositiveIntegerOption('--warmup', argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--warmup=')) {
      options.warmup = parsePositiveIntegerOption(
        '--warmup',
        arg.slice('--warmup='.length)
      );
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export function parsePositiveIntegerOption(name, value) {
  assertCondition(value !== undefined, `Missing value for ${name}`);

  const optionValue = String(value).trim();
  const parsedValue = Number(optionValue);

  assertCondition(
    /^\d+$/.test(optionValue) &&
      Number.isSafeInteger(parsedValue) &&
      parsedValue > 0,
    `${name} must be a positive integer`
  );

  return parsedValue;
}

export function calculateDurationStats(samples) {
  assertCondition(samples.length > 0, 'Cannot summarize an empty sample set');

  const sortedSamples = [...samples].sort((left, right) => left - right);
  const total = samples.reduce((sum, sample) => sum + sample, 0);
  const median =
    sortedSamples.length % 2 === 0
      ? (sortedSamples[sortedSamples.length / 2 - 1] +
          sortedSamples[sortedSamples.length / 2]) /
        2
      : sortedSamples[Math.floor(sortedSamples.length / 2)];

  return {
    average: total / samples.length,
    max: sortedSamples.at(-1),
    median,
    min: sortedSamples[0],
    p95: sortedSamples[Math.ceil(sortedSamples.length * 0.95) - 1],
  };
}

export function formatBytes(byteCount) {
  if (byteCount < 1024) {
    return `${byteCount} B`;
  }

  if (byteCount < 1024 * 1024) {
    return `${(byteCount / 1024).toFixed(2)} KiB`;
  }

  return `${(byteCount / 1024 / 1024).toFixed(2)} MiB`;
}

export function formatMilliseconds(milliseconds) {
  return `${milliseconds.toFixed(1)}ms`;
}

export function measureBundleArtifacts(bundleSpecs = defaultBundleSpecs) {
  return bundleSpecs.map(relativePath => {
    const absolutePath = repoPath(relativePath);
    const file = readFileSync(absolutePath);

    return {
      gzipBytes: gzipSync(file).length,
      name: relativePath,
      rawBytes: file.length,
    };
  });
}

export async function measureInputPerformance({
  input,
  iterations,
  parse,
  warmup,
}) {
  const canMeasureHeapDelta = typeof globalThis.gc === 'function';

  for (let count = 0; count < warmup; count += 1) {
    await parse(input);
  }

  const durationsMs = [];
  let maxHeapDeltaBytes = 0;

  for (let count = 0; count < iterations; count += 1) {
    globalThis.gc?.();

    const heapBeforeBytes = canMeasureHeapDelta
      ? process.memoryUsage().heapUsed
      : undefined;
    const startedAt = performance.now();

    await parse(input);

    durationsMs.push(performance.now() - startedAt);

    if (heapBeforeBytes !== undefined) {
      maxHeapDeltaBytes = Math.max(
        maxHeapDeltaBytes,
        process.memoryUsage().heapUsed - heapBeforeBytes
      );
    }
  }

  return {
    durationsMs,
    maxHeapDeltaBytes: canMeasureHeapDelta ? maxHeapDeltaBytes : undefined,
    stats: calculateDurationStats(durationsMs),
  };
}

export async function createPerformanceReport({
  bundleSpecs = defaultBundleSpecs,
  inputSpecs = defaultInputSpecs,
  iterations,
  parse,
  warmup,
}) {
  const inputs = [];

  for (const spec of inputSpecs) {
    const absolutePath = repoPath(spec.path);
    const file = readFileSync(absolutePath);
    const input = spec.kind === 'text' ? file.toString('utf8') : file;
    const measurement = await measureInputPerformance({
      input,
      iterations,
      parse,
      warmup,
    });

    inputs.push({
      file: basename(spec.path),
      kind: spec.kind,
      maxHeapDeltaBytes: measurement.maxHeapDeltaBytes,
      sizeBytes: file.length,
      stats: measurement.stats,
    });
  }

  return {
    bundles: measureBundleArtifacts(bundleSpecs),
    inputs,
    iterations,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    warmup,
  };
}

export function formatPerformanceReport(report) {
  const lines = [
    `Node: ${report.node} (${report.platform})`,
    `Iterations: ${report.iterations} measured, ${report.warmup} warmup`,
    report.inputs.some(input => input.maxHeapDeltaBytes === undefined)
      ? 'Heap delta: unavailable; rerun with node --expose-gc.'
      : 'Heap delta: maximum heap growth observed during a single measured parse.',
    '',
    'Parse latency:',
    '| Input | Kind | Size | Average | Median | p95 | Min | Max | Max heap delta |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const input of report.inputs) {
    lines.push(
      `| ${input.file} | ${input.kind} | ${formatBytes(
        input.sizeBytes
      )} | ${formatMilliseconds(input.stats.average)} | ${formatMilliseconds(
        input.stats.median
      )} | ${formatMilliseconds(input.stats.p95)} | ${formatMilliseconds(
        input.stats.min
      )} | ${formatMilliseconds(input.stats.max)} | ${
        input.maxHeapDeltaBytes === undefined
          ? 'n/a'
          : formatBytes(input.maxHeapDeltaBytes)
      } |`
    );
  }

  lines.push(
    '',
    'Bundle artifacts:',
    '| Artifact | Raw | Gzip |',
    '| --- | ---: | ---: |'
  );

  for (const bundle of report.bundles) {
    lines.push(
      `| ${bundle.name} | ${formatBytes(bundle.rawBytes)} | ${formatBytes(
        bundle.gzipBytes
      )} |`
    );
  }

  return lines.join('\n');
}

async function main() {
  const options = parseMeasurePerformanceArgs(process.argv.slice(2));
  const { parseLinkedInPDF } = await import('../dist/index.js');
  const report = await createPerformanceReport({
    iterations: options.iterations,
    parse: parseLinkedInPDF,
    warmup: options.warmup,
  });

  console.log(
    options.json
      ? JSON.stringify(report, null, 2)
      : formatPerformanceReport(report)
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
