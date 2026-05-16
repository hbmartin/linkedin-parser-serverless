import * as fs from 'node:fs';
import * as path from 'node:path';
import type { JsonFixtureDirectoryEntry } from './json-fixtures.js';

export function getNodeDirectoryEntryKind(
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
