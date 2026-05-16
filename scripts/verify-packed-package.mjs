import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import {
  assertCondition,
  executablePath,
  readJsonFile,
  repoPath,
  runCommand,
} from './lib/verification-helpers.mjs';

const sampleProfileText = `
Packed Consumer
packed.consumer@example.com
Software Engineer
Austin, Texas, United States

Experience
Developer at Packed Co
January 2020 - Present
`;

function main() {
  const manifest = readJsonFile(repoPath('package.json'));
  const packDirectory = mkdtempSync(join(tmpdir(), 'linkedin-parser-pack-'));
  const consumerDirectory = mkdtempSync(
    join(tmpdir(), 'linkedin-parser-consumer-')
  );

  try {
    const packageArchivePath = packPackage(packDirectory);
    installPackedPackage({ consumerDirectory, packageArchivePath });
    verifyInstalledEsmConsumer({
      consumerDirectory,
      packageName: manifest.name,
    });
    verifyInstalledCjsConsumer({
      consumerDirectory,
      packageName: manifest.name,
    });
    verifyInstalledTypes({ consumerDirectory, packageName: manifest.name });
    verifyInstalledCli({ consumerDirectory });

    console.log(
      'Verified npm pack contents, installed package imports, types, and CLI.'
    );
  } finally {
    if (process.env.KEEP_VERIFY_PACKAGE_TMP !== '1') {
      rmSync(packDirectory, { force: true, recursive: true });
      rmSync(consumerDirectory, { force: true, recursive: true });
    }
  }
}

function packPackage(packDirectory) {
  const packResult = runCommand({
    command: 'npm',
    args: ['pack', '--json', '--pack-destination', packDirectory],
  });
  const packEntries = JSON.parse(packResult.stdout);
  const packageEntry = packEntries[0];

  assertCondition(
    packageEntry !== undefined,
    'npm pack did not return a package'
  );

  const packedFiles = new Set(packageEntry.files.map(file => file.path));
  const requiredPackedFiles = [
    'bin/cli.js',
    'dist/cli.js',
    'dist/index.cjs',
    'dist/index.d.cts',
    'dist/index.d.ts',
    'dist/index.js',
    'dist/index.min.js',
    'package.json',
  ];

  for (const requiredFile of requiredPackedFiles) {
    assertCondition(
      packedFiles.has(requiredFile),
      `Packed package is missing ${requiredFile}`
    );
  }

  return isAbsolute(packageEntry.filename)
    ? packageEntry.filename
    : resolve(packDirectory, packageEntry.filename);
}

function installPackedPackage({ consumerDirectory, packageArchivePath }) {
  runCommand({
    command: 'npm',
    args: ['init', '-y'],
    cwd: consumerDirectory,
  });
  runCommand({
    command: 'npm',
    args: [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      packageArchivePath,
    ],
    cwd: consumerDirectory,
  });
}

function verifyInstalledEsmConsumer({ consumerDirectory, packageName }) {
  writeFileSync(
    join(consumerDirectory, 'esm-consumer.mjs'),
    `
import { parseLinkedInPDF } from ${JSON.stringify(packageName)};

const result = await parseLinkedInPDF(${JSON.stringify(sampleProfileText)});
if (result.profile.name !== 'Packed Consumer') {
  throw new Error('ESM import did not parse the expected profile name');
}
if (result.profile.contact.email !== 'packed.consumer@example.com') {
  throw new Error('ESM import did not parse the expected profile email');
}
`
  );

  runCommand({
    command: process.execPath,
    args: ['esm-consumer.mjs'],
    cwd: consumerDirectory,
  });
}

function verifyInstalledCjsConsumer({ consumerDirectory, packageName }) {
  writeFileSync(
    join(consumerDirectory, 'cjs-consumer.cjs'),
    `
const { parseLinkedInPDF } = require(${JSON.stringify(packageName)});

parseLinkedInPDF(${JSON.stringify(sampleProfileText)}).then(result => {
  if (result.profile.name !== 'Packed Consumer') {
    throw new Error('CJS require did not parse the expected profile name');
  }
  if (result.profile.contact.email !== 'packed.consumer@example.com') {
    throw new Error('CJS require did not parse the expected profile email');
  }
});
`
  );

  runCommand({
    command: process.execPath,
    args: ['cjs-consumer.cjs'],
    cwd: consumerDirectory,
  });
}

function verifyInstalledTypes({ consumerDirectory, packageName }) {
  writeFileSync(
    join(consumerDirectory, 'typecheck.ts'),
    `
import { parseLinkedInPDF, type ParseResult } from ${JSON.stringify(packageName)};

async function parseProfile(): Promise<ParseResult> {
  return parseLinkedInPDF(${JSON.stringify(sampleProfileText)});
}

void parseProfile();
`
  );

  runCommand({
    command: executablePath(repoPath('node_modules/.bin/tsc')),
    args: [
      '--strict',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--noEmit',
      '--skipLibCheck',
      'typecheck.ts',
    ],
    cwd: consumerDirectory,
  });
}

function verifyInstalledCli({ consumerDirectory }) {
  const cliPath = executablePath(
    join(consumerDirectory, 'node_modules/.bin/linkedin-pdf-parser')
  );
  const helpResult = runCommand({
    command: cliPath,
    args: ['--help'],
    cwd: consumerDirectory,
  });

  assertCondition(
    helpResult.stdout.includes('linkedin-pdf-parser verify-json <folder>'),
    'Installed CLI help output did not include expected usage text'
  );

  const parseResult = runCommand({
    command: cliPath,
    args: [repoPath('tests/fixtures/Profile.pdf'), '--compact'],
    cwd: consumerDirectory,
  });
  const parsedOutput = JSON.parse(parseResult.stdout);

  assertCondition(
    parsedOutput.profile?.name === 'Harold Martin',
    'Installed CLI did not parse the profile fixture'
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
