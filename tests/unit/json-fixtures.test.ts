import {
  formatErrorMessage,
  verifyJsonFixtures,
  writeJsonFixtures,
  type JsonFixtureDependencies,
  type JsonFixtureDirectoryEntry,
} from '../../src/json-fixtures.js';
import type { ParseOptions, ParseResult } from '../../src/index.js';

describe('JSON fixture batch operations', () => {
  test('writes JSON files for top-level PDFs only', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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

    const result = await writeJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
      outputFormat: 'pretty',
      overwriteExisting: false,
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining('Wrote 1 JSON file(s)'),
    });
    expect(memoryFixtures.readFilePaths).toEqual(['/baselines/Profile.pdf']);
    expect(memoryFixtures.writtenTextFiles).toEqual([
      {
        content: `${JSON.stringify(defaultParseResult, null, 2)}\n`,
        filePath: '/baselines/Profile.json',
      },
    ]);
  });

  test('does not replace existing JSON files without force', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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

    const result = await writeJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
      outputFormat: 'pretty',
      overwriteExisting: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'JSON already exists: /baselines/Profile.json'
    );
    expect(memoryFixtures.readFilePaths).toEqual([]);
    expect(memoryFixtures.writtenTextFiles).toEqual([]);
  });

  test('reports parse failures while writing JSON fixtures', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
      binaryFiles: new Map([['/baselines/Profile.pdf', new Uint8Array([1])]]),
      directories: new Set(['/baselines']),
      directoryEntries: new Map([
        ['/baselines', [{ kind: 'file', name: 'Profile.pdf' }]],
      ]),
      parsePdf: async () => {
        throw new Error('write parse failed');
      },
    });

    const result = await writeJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
      outputFormat: 'pretty',
      overwriteExisting: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      '/baselines/Profile.pdf: write parse failed'
    );
    expect(memoryFixtures.writtenTextFiles).toEqual([]);
  });

  test('overwrites existing JSON files with compact output and raw text parsing when forced', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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

    const result = await writeJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: true,
      outputFormat: 'compact',
      overwriteExisting: true,
    });

    expect(result.exitCode).toBe(0);
    expect(memoryFixtures.parseOptions).toEqual([{ includeRawText: true }]);
    expect(memoryFixtures.writtenTextFiles).toEqual([
      {
        content: `${JSON.stringify(defaultParseResult)}\n`,
        filePath: '/baselines/Profile.JSON',
      },
    ]);
  });

  test('verifies matching PDF and JSON pairs with JSON-normalized generated output', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: true,
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining('Verified 1 PDF/JSON pair(s)'),
    });
    expect(memoryFixtures.parseOptions).toEqual([{ includeRawText: true }]);
    expect(memoryFixtures.readFilePaths).toEqual(['/baselines/Profile.PDF']);
  });

  test('verifies structurally equivalent JSON regardless of formatting or key order', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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
        [
          '/baselines/Profile.json',
          `{
            "diagnostics": {
              "confidence": 0.7,
              "isEmpty": false,
              "isLikelyLinkedInExport": true,
              "sectionsFound": ["experience"]
            },
            "warnings": [],
            "profile": {
              "volunteer_work": [],
              "top_skills": [],
              "projects": [],
              "publications": [],
              "honors_awards": [],
              "name": "Orion Helios",
              "location": "San Francisco, CA",
              "languages": [],
              "headline": "Fixture headline",
              "experience": [
                {
                  "title": "Fixture Role",
                  "duration": "January 2020 - Present",
                  "company": "Fixture Co"
                }
              ],
              "experience_groups": [
                {
                  "company": "Fixture Co",
                  "positions": [
                    {
                      "title": "Fixture Role",
                      "duration": "January 2020 - Present"
                    }
                  ]
                }
              ],
              "education": [],
              "contact": {
                "email": "fixture@example.com"
              },
              "certifications": []
            }
          }`,
        ],
      ]),
    });

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining('Verified 1 PDF/JSON pair(s)'),
    });
  });

  test('prints a compact context diff when generated JSON differs from the fixture', async () => {
    const expectedResult: ParseResult = {
      ...defaultParseResult,
      profile: {
        ...defaultParseResult.profile,
        name: 'Hermes Trismegistus',
      },
    };
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--- expected');
    expect(result.stderr).toContain('+++ generated');
    expect(result.stderr).toContain('@@ -');
    expect(result.stderr).toContain('-    "name": "Hermes Trismegistus"');
    expect(result.stderr).toContain('+    "name": "Orion Helios"');
    expect(result.stderr).not.toContain('"diagnostics": {');
    expect(result.stderr).not.toContain('"company": "Fixture Co"');
  });

  test('keeps context diffs focused around JSON insertions without positional cascade noise', async () => {
    const generatedResult: ParseResult = {
      ...defaultParseResult,
      profile: {
        ...defaultParseResult.profile,
        top_skills: ['TypeScript'],
      },
    };
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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
      parsePdf: async () => generatedResult,
      textFiles: new Map([
        ['/baselines/Profile.json', JSON.stringify(defaultParseResult)],
      ]),
    });

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('@@ -');
    expect(result.stderr).toContain('+      "TypeScript"');
    expect(result.stderr).not.toContain('-    "volunteer_work": []');
    expect(result.stderr).not.toContain('+    "volunteer_work": []');
  });

  test('prints separate context hunks for distant generated JSON changes', async () => {
    const expectedResult: ParseResult = {
      ...defaultParseResult,
      diagnostics: {
        ...defaultParseResult.diagnostics,
        confidence: 0.5,
      },
      profile: {
        ...defaultParseResult.profile,
        name: 'Hermes Trismegistus',
      },
    };
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.match(/^@@/gm)).toHaveLength(2);
    expect(result.stderr).toContain('-    "confidence": 0.5,');
    expect(result.stderr).toContain('+    "confidence": 0.7,');
    expect(result.stderr).toContain('-    "name": "Hermes Trismegistus"');
    expect(result.stderr).toContain('+    "name": "Orion Helios"');
  });

  test('prints JSON keypath changes when requested', async () => {
    const expectedResult = {
      ...defaultParseResult,
      legacy: {
        emptyArray: [],
        tags: ['old'],
      },
      profile: {
        ...defaultParseResult.profile,
        contact: {
          ...defaultParseResult.profile.contact,
          email: 'old@example.com',
          'weird.key': 'old value',
        },
        name: 'Hermes Trismegistus',
        top_skills: ['TypeScript', 'Node.js'],
      },
    };
    const generatedResult = {
      ...defaultParseResult,
      modern: {
        emptyObject: {},
        tags: ['new'],
      },
      profile: {
        ...defaultParseResult.profile,
        contact: {
          ...defaultParseResult.profile.contact,
          email: 'new@example.com',
          'weird.key': 'new value',
        },
        top_skills: ['TypeScript', 'Node.js', 'Zod'],
      },
    };
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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
      parsePdf: async () => generatedResult,
      textFiles: new Map([
        ['/baselines/Profile.json', JSON.stringify(expectedResult)],
      ]),
    });

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      diffOutputFormat: 'json-paths',
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toContain('--- expected');
    expect(result.stderr).toContain(
      '~ profile.contact.email: "old@example.com" -> "new@example.com"'
    );
    expect(result.stderr).toContain(
      '~ profile.contact["weird.key"]: "old value" -> "new value"'
    );
    expect(result.stderr).toContain(
      '~ profile.name: "Hermes Trismegistus" -> "Orion Helios"'
    );
    expect(result.stderr).toContain('+ profile.top_skills[2]: "Zod"');
    expect(result.stderr).toContain('- legacy.emptyArray: []');
    expect(result.stderr).toContain('- legacy.tags[0]: "old"');
    expect(result.stderr).toContain('+ modern.emptyObject: {}');
    expect(result.stderr).toContain('+ modern.tags[0]: "new"');
  });

  test('prints root JSON keypath changes for unequal root value kinds', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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
      textFiles: new Map([['/baselines/Profile.json', '"legacy"']]),
    });

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      diffOutputFormat: 'json-paths',
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('~ $: "legacy" -> {');
  });

  test('prints context diffs for unequal root value kinds', async () => {
    const generatedPrimitive = JSON.parse('"generated"');
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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
      parsePdf: async () => generatedPrimitive,
      textFiles: new Map([
        ['/baselines/Profile.json', JSON.stringify(defaultParseResult)],
      ]),
    });

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('-{');
    expect(result.stderr).toContain('+"generated"');
  });

  test('reports invalid JSON, parse failures, and missing fixture pairs', async () => {
    const brokenPdfBytes = new Uint8Array([2]);
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
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

  test('handles empty fixture folders consistently', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
      directories: new Set(['/baselines']),
      directoryEntries: new Map([['/baselines', []]]),
    });

    const writeResult = await writeJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
      outputFormat: 'pretty',
      overwriteExisting: false,
    });
    const verifyResult = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(writeResult).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: 'Wrote 0 JSON file(s) in /baselines.\n',
    });
    expect(verifyResult).toEqual({
      exitCode: 1,
      stderr: 'Error: No matching PDF/JSON pairs found in /baselines\n',
      stdout: '',
    });
  });

  test('reports directory resolution errors', async () => {
    const memoryFixtures = createMemoryJsonFixtureDependencies({
      binaryFiles: new Map([['/not-a-directory', new Uint8Array([1])]]),
    });

    const filePathResult = await writeJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/not-a-directory',
      includeRawText: false,
      outputFormat: 'pretty',
      overwriteExisting: false,
    });
    const missingPathResult = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/missing',
      includeRawText: false,
    });

    expect(filePathResult).toEqual({
      exitCode: 1,
      stderr: 'Error: Path must be a directory: /not-a-directory\n',
      stdout: '',
    });
    expect(missingPathResult).toEqual({
      exitCode: 1,
      stderr: 'Error: Directory not found: /missing\n',
      stdout: '',
    });
  });

  test('formats non-error thrown values and diffs unequal JSON shapes', async () => {
    const expectedResult: ParseResult = {
      ...defaultParseResult,
      warnings: [
        {
          code: 'missing_profile_field',
          field: 'profile.name',
          message: 'Could not extract profile name',
        },
      ],
    };
    const memoryFixtures = createMemoryJsonFixtureDependencies({
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

    const result = await verifyJsonFixtures({
      dependencies: memoryFixtures.dependencies,
      folderPath: '/baselines',
      includeRawText: false,
    });

    expect(formatErrorMessage('plain failure')).toBe('plain failure');
    expect(result.stderr).toContain('-      "code": "missing_profile_field",');
    expect(result.stderr).toContain('+  "warnings": []');
  });
});

interface MemoryJsonFixtureDependenciesParams {
  binaryFiles?: Map<string, Uint8Array>;
  directories?: Set<string>;
  directoryEntries?: Map<string, JsonFixtureDirectoryEntry[]>;
  fileExists?: JsonFixtureDependencies['fileExists'];
  parsePdf?: JsonFixtureDependencies['parsePdf'];
  resolvePath?: (filePath: string) => string;
  textFiles?: Map<string, string>;
}

interface TextFileWrite {
  content: string;
  filePath: string;
}

interface MemoryJsonFixtureDependencies {
  dependencies: JsonFixtureDependencies;
  parseOptions: ParseOptions[];
  readFilePaths: string[];
  writtenTextFiles: TextFileWrite[];
}

const defaultParseResult: ParseResult = {
  diagnostics: {
    confidence: 0.7,
    isEmpty: false,
    isLikelyLinkedInExport: true,
    sectionsFound: ['experience'],
  },
  profile: {
    certifications: [],
    contact: {
      email: 'fixture@example.com',
    },
    education: [],
    experience: [
      {
        company: 'Fixture Co',
        duration: 'January 2020 - Present',
        location: undefined,
        title: 'Fixture Role',
      },
    ],
    experience_groups: [
      {
        company: 'Fixture Co',
        positions: [
          {
            duration: 'January 2020 - Present',
            location: undefined,
            title: 'Fixture Role',
          },
        ],
      },
    ],
    headline: 'Fixture headline',
    honors_awards: [],
    languages: [],
    location: 'San Francisco, CA',
    name: 'Orion Helios',
    projects: [],
    publications: [],
    summary: undefined,
    top_skills: [],
    volunteer_work: [],
  },
  warnings: [],
};

function createMemoryJsonFixtureDependencies(
  params: MemoryJsonFixtureDependenciesParams = {}
): MemoryJsonFixtureDependencies {
  const binaryFiles = params.binaryFiles ?? new Map<string, Uint8Array>();
  const directories = params.directories ?? new Set<string>();
  const directoryEntries =
    params.directoryEntries ?? new Map<string, JsonFixtureDirectoryEntry[]>();
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

        if (file === undefined) {
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
