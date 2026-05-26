import { jest } from '@jest/globals';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  main,
  runCli,
  type CliDependencies,
  type CliDirectoryEntry,
  type CliResult,
} from '../../src/cli.js';
import type { ParseOptions, ParseResult } from '../../src/index.js';

describe('CLI runner', () => {
  const profilePdfPath = fileURLToPath(
    new URL('../fixtures/Profile.pdf', import.meta.url)
  );
  const nonPdfPath = fileURLToPath(
    new URL('../../package.json', import.meta.url)
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('prints usage for help', async () => {
    const result = await runCli({ args: ['--help'] });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining(
        'linkedin-pdf-parser write-json <folder>'
      ),
    });
  });

  test('reports an invalid command when only non-help flags are provided', async () => {
    const result = await runCli({ args: ['--compact'] });

    expect(result).toEqual({
      exitCode: 1,
      stderr: expect.stringContaining('Error: No PDF file path provided'),
      stdout: '',
    });
  });

  test('reports invalid folder command arguments', async () => {
    await expect(runCli({ args: ['write-json'] })).resolves.toEqual({
      exitCode: 1,
      stderr: expect.stringContaining(
        'Error: No folder path provided for write-json'
      ),
      stdout: '',
    });
    await expect(
      runCli({ args: ['verify-json', '/one', '/two'] })
    ).resolves.toEqual({
      exitCode: 1,
      stderr: expect.stringContaining(
        'Error: Only one folder path may be provided for verify-json'
      ),
      stdout: '',
    });
  });

  test('returns compact JSON for a valid PDF', async () => {
    const result = await runCli({
      args: [profilePdfPath, '--compact'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toEqual(expect.stringMatching(/^\{"profile":/));
    expect(result.stdout).not.toContain('\n  "profile"');
    expectJsonProfile(result, {
      email: 'harold.martin@gmail.com',
      name: 'Harold Martin',
    });
  });

  test('pretty-prints JSON and includes raw text when requested', async () => {
    const result = await runCli({
      args: [profilePdfPath, '--raw-text'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('\n  "profile":');
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        rawText: expect.stringContaining('Harold Martin'),
      })
    );
    expectJsonProfile(result, {
      email: 'harold.martin@gmail.com',
      name: 'Harold Martin',
    });
  });

  test('rejects missing PDF paths', async () => {
    const result = await runCli({
      args: ['missing.pdf'],
    });

    expect(result).toEqual({
      exitCode: 1,
      stderr: expect.stringContaining('Error: File not found:'),
      stdout: '',
    });
  });

  test('rejects non-PDF files before reading them', async () => {
    const result = await runCli({
      args: [nonPdfPath],
    });

    expect(result).toEqual({
      exitCode: 1,
      stderr: `Error: File must be a PDF: ${nonPdfPath}\n`,
      stdout: '',
    });
  });

  test('writes help output through the executable main entry point', async () => {
    const stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const exitCode = await main(['--help']);

    expect(exitCode).toBe(0);
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('linkedin-pdf-parser verify-json <folder>')
    );
  });

  test('uses process argv when main is called without explicit args', async () => {
    const originalArgv = process.argv;
    const stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    process.argv = ['node', 'linkedin-pdf-parser', '--help'];

    try {
      const exitCode = await main();

      expect(exitCode).toBe(0);
      expect(stderrSpy).not.toHaveBeenCalled();
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('linkedin-pdf-parser <pdf-file-path>')
      );
    } finally {
      process.argv = originalArgv;
    }
  });

  test('writes parse output through the executable main entry point', async () => {
    const stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const exitCode = await main([profilePdfPath, '--compact']);

    expect(exitCode).toBe(0);
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\{"profile":/)
    );
  });

  test('returns failure codes from the executable main entry point', async () => {
    const stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const exitCode = await main(['--compact']);

    expect(exitCode).toBe(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error: No PDF file path provided')
    );
  });

  test('reports parser failures', async () => {
    const result = await runCli({
      args: [profilePdfPath],
      dependencies: createMemoryCliDependencies({
        binaryFiles: new Map([[profilePdfPath, new Uint8Array([1, 2, 3])]]),
        parsePdf: async () => {
          throw new Error('parse failed');
        },
        resolvePath: filePath => filePath,
      }).dependencies,
    });

    expect(result).toEqual({
      exitCode: 1,
      stderr: 'Error: parse failed\n',
      stdout: '',
    });
  });

  test('accepts directories when file existence only checks regular files', async () => {
    const memoryCli = createMemoryCliDependencies({
      directories: new Set(['/baselines']),
      fileExists: () => false,
    });

    const result = await runCli({
      args: ['write-json', '/baselines'],
      dependencies: memoryCli.dependencies,
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining('Wrote 0 JSON file(s)'),
    });
  });

  test('writes JSON files for top-level PDFs only', async () => {
    const memoryCli = createMemoryCliDependencies({
      binaryFiles: new Map([['/baselines/Profile.pdf', new Uint8Array([1])]]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        [
          '/baselines',
          [
            { kind: 'file', name: 'Profile.pdf' },
            { kind: 'file', name: 'notes.txt' },
            { kind: 'directory', name: 'Nested.pdf' },
          ],
        ],
      ]),
    });

    const result = await runCli({
      args: ['write-json', '/baselines'],
      dependencies: memoryCli.dependencies,
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining('Wrote 1 JSON file(s)'),
    });
    expect(memoryCli.readFilePaths).toEqual(['/baselines/Profile.pdf']);
    expect(memoryCli.writtenTextFiles).toEqual([
      {
        content: `${JSON.stringify(defaultParseResult, null, 2)}\n`,
        filePath: '/baselines/Profile.json',
      },
    ]);
  });

  test('writes JSON files for symlinked PDFs', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-cli-'));
    const nestedDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'linkedin-nested-')
    );
    const nestedSymlinkPath = path.join(tempDir, 'Nested.pdf');
    const symlinkPath = path.join(tempDir, 'Profile-Link.pdf');

    try {
      fs.symlinkSync(nestedDir, nestedSymlinkPath, 'dir');
      fs.symlinkSync(profilePdfPath, symlinkPath, 'file');

      const result = await runCli({
        args: ['write-json', tempDir, '--compact'],
      });

      expect(result).toEqual({
        exitCode: 0,
        stderr: '',
        stdout: expect.stringContaining('Wrote 1 JSON file(s)'),
      });
      expect(fs.existsSync(path.join(tempDir, 'Profile-Link.json'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
      fs.rmSync(nestedDir, { force: true, recursive: true });
    }
  });

  test('refuses to replace existing JSON files without force', async () => {
    const memoryCli = createMemoryCliDependencies({
      binaryFiles: new Map([['/baselines/Profile.pdf', new Uint8Array([1])]]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        [
          '/baselines',
          [
            { kind: 'file', name: 'Profile.pdf' },
            { kind: 'file', name: 'Profile.json' },
          ],
        ],
      ]),
      textFiles: new Map([['/baselines/Profile.json', '{}']]),
    });

    const result = await runCli({
      args: ['write-json', '/baselines'],
      dependencies: memoryCli.dependencies,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'JSON already exists: /baselines/Profile.json'
    );
    expect(memoryCli.readFilePaths).toEqual([]);
    expect(memoryCli.writtenTextFiles).toEqual([]);
  });

  test('overwrites existing JSON files with force', async () => {
    const memoryCli = createMemoryCliDependencies({
      binaryFiles: new Map([['/baselines/Profile.PDF', new Uint8Array([1])]]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        [
          '/baselines',
          [
            { kind: 'file', name: 'Profile.PDF' },
            { kind: 'file', name: 'Profile.JSON' },
          ],
        ],
      ]),
      textFiles: new Map([['/baselines/Profile.JSON', '{}']]),
    });

    const result = await runCli({
      args: ['write-json', '/baselines', '--force', '--compact'],
      dependencies: memoryCli.dependencies,
    });

    expect(result.exitCode).toBe(0);
    expect(memoryCli.writtenTextFiles).toEqual([
      {
        content: `${JSON.stringify(defaultParseResult)}\n`,
        filePath: '/baselines/Profile.JSON',
      },
    ]);
  });

  test('passes raw text options to write-json parsing', async () => {
    const memoryCli = createMemoryCliDependencies({
      binaryFiles: new Map([['/baselines/Profile.pdf', new Uint8Array([1])]]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        ['/baselines', [{ kind: 'file', name: 'Profile.pdf' }]],
      ]),
    });

    const result = await runCli({
      args: ['write-json', '/baselines', '--raw-text'],
      dependencies: memoryCli.dependencies,
    });

    expect(result.exitCode).toBe(0);
    expect(memoryCli.parseOptions).toEqual([{ includeRawText: true }]);
  });

  test('verifies matching PDF and JSON pairs', async () => {
    const memoryCli = createMemoryCliDependencies({
      binaryFiles: new Map([['/baselines/Profile.PDF', new Uint8Array([1])]]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        [
          '/baselines',
          [
            { kind: 'file', name: 'Profile.PDF' },
            { kind: 'file', name: 'profile.json' },
          ],
        ],
      ]),
      textFiles: new Map([
        ['/baselines/profile.json', JSON.stringify(defaultParseResult)],
      ]),
    });

    const result = await runCli({
      args: ['verify-json', '/baselines'],
      dependencies: memoryCli.dependencies,
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining('Verified 1 PDF/JSON pair(s)'),
    });
    expect(memoryCli.readFilePaths).toEqual(['/baselines/Profile.PDF']);
  });

  test('passes raw text options to verify-json parsing', async () => {
    const memoryCli = createMemoryCliDependencies({
      binaryFiles: new Map([['/baselines/Profile.pdf', new Uint8Array([1])]]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        [
          '/baselines',
          [
            { kind: 'file', name: 'Profile.pdf' },
            { kind: 'file', name: 'Profile.json' },
          ],
        ],
      ]),
      textFiles: new Map([
        ['/baselines/Profile.json', JSON.stringify(defaultParseResult)],
      ]),
    });

    const result = await runCli({
      args: ['verify-json', '--raw-text', '/baselines'],
      dependencies: memoryCli.dependencies,
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining('Verified 1 PDF/JSON pair(s)'),
    });
    expect(memoryCli.parseOptions).toEqual([{ includeRawText: true }]);
  });

  test('prints a full diff when verify-json finds a mismatch', async () => {
    const expectedResult: ParseResult = {
      ...defaultParseResult,
      profile: {
        ...defaultParseResult.profile,
        name: 'Hermes Trismegistus',
      },
    };
    const memoryCli = createMemoryCliDependencies({
      binaryFiles: new Map([['/baselines/Profile.pdf', new Uint8Array([1])]]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        [
          '/baselines',
          [
            { kind: 'file', name: 'Profile.pdf' },
            { kind: 'file', name: 'Profile.json' },
          ],
        ],
      ]),
      textFiles: new Map([
        ['/baselines/Profile.json', JSON.stringify(expectedResult)],
      ]),
    });

    const result = await runCli({
      args: ['verify-json', '/baselines'],
      dependencies: memoryCli.dependencies,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--- expected');
    expect(result.stderr).toContain('+++ generated');
    expect(result.stderr).toContain('-     "name": "Hermes Trismegistus"');
    expect(result.stderr).toContain('+     "name": "Orion Helios"');
  });

  test('reports invalid JSON, parse failures, and missing pairs', async () => {
    const brokenPdfBytes = new Uint8Array([2]);
    const memoryCli = createMemoryCliDependencies({
      binaryFiles: new Map([
        ['/baselines/Broken.pdf', brokenPdfBytes],
        ['/baselines/Empty.pdf', new Uint8Array([5])],
        ['/baselines/Invalid.pdf', new Uint8Array([3])],
        ['/baselines/MissingJson.pdf', new Uint8Array([4])],
      ]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        [
          '/baselines',
          [
            { kind: 'file', name: 'Broken.pdf' },
            { kind: 'file', name: 'Broken.json' },
            { kind: 'file', name: 'Empty.pdf' },
            { kind: 'file', name: 'Empty.json' },
            { kind: 'file', name: 'Invalid.pdf' },
            { kind: 'file', name: 'Invalid.json' },
            { kind: 'file', name: 'MissingJson.pdf' },
            { kind: 'file', name: 'Orphan.json' },
          ],
        ],
      ]),
      parsePdf: async input => {
        if (input === brokenPdfBytes) {
          throw new Error('parse failed');
        }

        return defaultParseResult;
      },
      textFiles: new Map([
        ['/baselines/Broken.json', JSON.stringify(defaultParseResult)],
        ['/baselines/Empty.json', ''],
        ['/baselines/Invalid.json', '{'],
        ['/baselines/Orphan.json', JSON.stringify(defaultParseResult)],
      ]),
    });

    const result = await runCli({
      args: ['verify-json', '/baselines'],
      dependencies: memoryCli.dependencies,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('/baselines/Broken.pdf: parse failed');
    expect(result.stderr).toContain(
      '/baselines/Empty.json: Invalid JSON baseline: Unexpected end of JSON input'
    );
    expect(result.stderr).toContain(
      '/baselines/Invalid.json: Invalid JSON baseline'
    );
    expect(result.stderr).toContain(
      '/baselines/MissingJson.pdf: Missing JSON baseline'
    );
    expect(result.stderr).toContain(
      '/baselines/Orphan.json: Missing PDF source'
    );
  });
});

interface ExpectedProfileFields {
  email: string;
  name: string;
}

function expectJsonProfile(
  result: CliResult,
  expected: ExpectedProfileFields
): void {
  expect(JSON.parse(result.stdout)).toEqual(
    expect.objectContaining({
      profile: expect.objectContaining({
        contact: expect.objectContaining({
          email: expected.email,
        }),
        name: expected.name,
      }),
    })
  );
}

interface MemoryCliDependenciesParams {
  binaryFiles?: Map<string, Uint8Array>;
  directories?: Set<string>;
  directoryEntries?: Map<string, CliDirectoryEntry[]>;
  fileExists?: CliDependencies['fileExists'];
  parsePdf?: CliDependencies['parsePdf'];
  resolvePath?: (filePath: string) => string;
  textFiles?: Map<string, string>;
}

interface TextFileWrite {
  content: string;
  filePath: string;
}

interface MemoryCliDependencies {
  dependencies: CliDependencies;
  parseOptions: ParseOptions[];
  readFilePaths: string[];
  writtenTextFiles: TextFileWrite[];
}

const defaultParseResult: ParseResult = {
  profile: {
    certifications: [],
    contact: {
      email: 'fixture@example.com',
    },
    education: [],
    experience: [],
    headline: 'Fixture headline',
    languages: [],
    location: 'San Francisco, CA',
    name: 'Orion Helios',
    projects: [],
    publications: [],
    top_skills: [],
    volunteer_work: [],
  },
  warnings: [],
};

function createMemoryCliDependencies(
  params: MemoryCliDependenciesParams = {}
): MemoryCliDependencies {
  const binaryFiles = params.binaryFiles ?? new Map<string, Uint8Array>();
  const directories = params.directories ?? new Set<string>();
  const directoryEntries =
    params.directoryEntries ?? new Map<string, CliDirectoryEntry[]>();
  const parseOptions: ParseOptions[] = [];
  const readFilePaths: string[] = [];
  const textFiles = params.textFiles ?? new Map<string, string>();
  const writtenTextFiles: TextFileWrite[] = [];

  return {
    dependencies: {
      directoryExists: directoryPath => directories.has(directoryPath),
      fileExists:
        params.fileExists ??
        (filePath =>
          directories.has(filePath) ||
          binaryFiles.has(filePath) ||
          textFiles.has(filePath)),
      listDirectory: directoryPath => directoryEntries.get(directoryPath) ?? [],
      parsePdf: async (input, options) => {
        parseOptions.push(options);

        if (params.parsePdf) {
          return params.parsePdf(input, options);
        }

        return defaultParseResult;
      },
      readFile: filePath => {
        const file = binaryFiles.get(filePath);

        readFilePaths.push(filePath);

        if (!file) {
          throw new Error(`Missing binary file: ${filePath}`);
        }

        return file;
      },
      readTextFile: filePath => {
        const file = textFiles.get(filePath);

        if (file === undefined) {
          throw new Error(`Missing text file: ${filePath}`);
        }

        return file;
      },
      resolvePath: params.resolvePath ?? (filePath => filePath),
      writeTextFile: (filePath, content) => {
        textFiles.set(filePath, content);
        writtenTextFiles.push({ content, filePath });
      },
    },
    parseOptions,
    readFilePaths,
    writtenTextFiles,
  };
}
