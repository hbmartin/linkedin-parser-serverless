import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLinkedInPDF } from '../../src/index.js';
import {
  verifyJsonFixtures,
  type JsonFixtureDependencies,
  type JsonFixtureDirectoryEntry,
} from '../../src/json-fixtures.js';

describe('PDF/JSON fixture baselines', () => {
  const fixturesPath = fileURLToPath(
    new URL('../fixtures', import.meta.url)
  );

  test('verifies every checked-in structured JSON fixture against its PDF', async () => {
    const result = await verifyJsonFixtures({
      dependencies: createNodeJsonFixtureDependencies(),
      folderPath: fixturesPath,
      includeRawText: false,
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: expect.stringContaining('Verified 2 PDF/JSON pair(s)'),
    });
    expect(result.stdout).toContain(path.join(fixturesPath, 'Profile.pdf'));
    expect(result.stdout).toContain(
      path.join(fixturesPath, 'test_resume.pdf')
    );
  });

  test('keeps checked-in fixture JSON structured-only', () => {
    const jsonFileNames = fs
      .readdirSync(fixturesPath)
      .filter(fileName => fileName.toLowerCase().endsWith('.json'))
      .sort((left, right) => left.localeCompare(right));

    expect(jsonFileNames).toEqual(['Profile.json', 'test_resume.json']);

    for (const jsonFileName of jsonFileNames) {
      const parsedJson: unknown = JSON.parse(
        fs.readFileSync(path.join(fixturesPath, jsonFileName), 'utf8')
      );

      expect(parsedJson).not.toHaveProperty('rawText');
    }
  });
});

function createNodeJsonFixtureDependencies(): JsonFixtureDependencies {
  return {
    directoryExists: directoryPath =>
      fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory(),
    fileExists: fs.existsSync,
    listDirectory: directoryPath =>
      fs.readdirSync(directoryPath, { withFileTypes: true }).map(entry => ({
        kind: getNodeDirectoryEntryKind(directoryPath, entry),
        name: entry.name,
      })),
    parsePdf: parseLinkedInPDF,
    readFile: fs.readFileSync,
    readTextFile: filePath => fs.readFileSync(filePath, 'utf8'),
    resolvePath: path.resolve,
    writeTextFile: fs.writeFileSync,
  };
}

function getNodeDirectoryEntryKind(
  directoryPath: string,
  entry: fs.Dirent
): JsonFixtureDirectoryEntry['kind'] {
  if (entry.isFile()) {
    return 'file';
  }

  if (entry.isDirectory()) {
    return 'directory';
  }

  if (!entry.isSymbolicLink()) {
    return 'other';
  }

  try {
    const stats = fs.statSync(path.join(directoryPath, entry.name));

    if (stats.isFile()) {
      return 'file';
    }

    if (stats.isDirectory()) {
      return 'directory';
    }
  } catch {
    return 'other';
  }

  return 'other';
}
