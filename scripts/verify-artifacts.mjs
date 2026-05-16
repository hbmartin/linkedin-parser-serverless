import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  assertCondition,
  ensureRegularFile,
  readJsonFile,
  repoPath,
  runCommand,
} from './lib/verification-helpers.mjs';

const expectedFiles = [
  'bin/cli.js',
  'dist/cli.d.ts',
  'dist/cli.js',
  'dist/cli.js.map',
  'dist/index.cjs',
  'dist/index.cjs.map',
  'dist/index.d.cts',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/index.js.map',
  'dist/index.min.js',
  'dist/index.min.js.map',
];

const externalDependencyPatterns = [
  {
    file: 'dist/index.js',
    patterns: [
      /from\s*['"]chrono-node['"]/,
      /from\s*['"]unpdf['"]/,
      /from\s*['"]zod['"]/,
    ],
  },
  {
    file: 'dist/index.cjs',
    patterns: [
      /require\(['"]chrono-node['"]\)/,
      /require\(['"]unpdf['"]\)/,
      /require\(['"]zod['"]\)/,
    ],
  },
  {
    file: 'dist/index.min.js',
    patterns: [
      /from\s*['"]chrono-node['"]/,
      /from\s*['"]unpdf['"]/,
      /from\s*['"]zod['"]/,
    ],
  },
];

const sampleProfileText = `
Artifact User
artifact.user@example.com
Software Engineer
New York, New York, United States

Experience
Developer at Artifact Co
January 2020 - Present
`;

async function main() {
  expectedFiles.forEach(ensureRegularFile);
  verifyPackageManifest();
  verifyExternalDependencies();
  await verifyBundleExports();
  verifyCliEntrypoint();

  console.log('Verified build artifacts, bundle exports, externals, and CLI.');
}

function verifyPackageManifest() {
  const manifest = readJsonFile(repoPath('package.json'));

  assertCondition(
    manifest.main === 'dist/index.cjs',
    'package.json main must point to dist/index.cjs'
  );
  assertCondition(
    manifest.module === 'dist/index.js',
    'package.json module must point to dist/index.js'
  );
  assertCondition(
    manifest.types === 'dist/index.d.ts',
    'package.json types must point to dist/index.d.ts'
  );
  assertCondition(
    manifest.exports?.['.']?.import?.default === './dist/index.js',
    'package.json ESM export must point to ./dist/index.js'
  );
  assertCondition(
    manifest.exports?.['.']?.require?.default === './dist/index.cjs',
    'package.json CJS export must point to ./dist/index.cjs'
  );
  assertCondition(
    manifest.bin?.['linkedin-pdf-parser'] === './bin/cli.js',
    'package.json bin must point to ./bin/cli.js'
  );
}

function verifyExternalDependencies() {
  for (const externalCheck of externalDependencyPatterns) {
    const source = readFileSync(repoPath(externalCheck.file), 'utf8');

    for (const pattern of externalCheck.patterns) {
      assertCondition(
        pattern.test(source),
        `${externalCheck.file} does not preserve external dependency pattern ${pattern}`
      );
    }
  }
}

async function verifyBundleExports() {
  const cacheBust = `?verified=${Date.now()}`;
  const esmBundle = await import(
    `${pathToFileURL(repoPath('dist/index.js')).href}${cacheBust}`
  );
  const minifiedBundle = await import(
    `${pathToFileURL(repoPath('dist/index.min.js')).href}${cacheBust}`
  );
  const cjsBundle = createRequire(import.meta.url)(repoPath('dist/index.cjs'));

  await verifyParserExport('dist/index.js', esmBundle.parseLinkedInPDF);
  await verifyParserExport(
    'dist/index.min.js',
    minifiedBundle.parseLinkedInPDF
  );
  await verifyParserExport('dist/index.cjs', cjsBundle.parseLinkedInPDF);
}

async function verifyParserExport(bundleName, parseLinkedInPDF) {
  assertCondition(
    typeof parseLinkedInPDF === 'function',
    `${bundleName} must export parseLinkedInPDF`
  );

  const result = await parseLinkedInPDF(sampleProfileText);

  assertCondition(
    result.profile.name === 'Artifact User',
    `${bundleName} did not parse the sample profile name`
  );
  assertCondition(
    result.profile.contact.email === 'artifact.user@example.com',
    `${bundleName} did not parse the sample profile email`
  );
}

function verifyCliEntrypoint() {
  const helpResult = runCommand({
    command: process.execPath,
    args: [repoPath('bin/cli.js'), '--help'],
  });
  assertCondition(
    helpResult.stdout.includes('linkedin-pdf-parser verify-json <folder>'),
    'CLI help output did not include expected usage text'
  );

  const parseResult = runCommand({
    command: process.execPath,
    args: [
      repoPath('bin/cli.js'),
      repoPath('tests/fixtures/Profile.pdf'),
      '--compact',
    ],
  });
  const parsedOutput = JSON.parse(parseResult.stdout);

  assertCondition(
    parsedOutput.profile?.name === 'Harold Martin',
    'CLI did not parse the profile fixture through the built artifact'
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
