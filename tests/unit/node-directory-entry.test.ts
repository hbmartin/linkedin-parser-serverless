import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getNodeDirectoryEntryKind } from '../../src/node-directory-entry.js';

describe('getNodeDirectoryEntryKind', () => {
  let directoryPath: string;

  beforeEach(() => {
    directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'node-directory-entry-')
    );
  });

  afterEach(() => {
    fs.rmSync(directoryPath, { force: true, recursive: true });
  });

  test('classifies files and directories', () => {
    fs.writeFileSync(path.join(directoryPath, 'profile.pdf'), '');
    fs.mkdirSync(path.join(directoryPath, 'nested'));

    expect(readEntryKind('profile.pdf')).toBe('file');
    expect(readEntryKind('nested')).toBe('directory');
  });

  test('classifies symlinks by their resolved target', () => {
    fs.writeFileSync(path.join(directoryPath, 'profile.pdf'), '');
    fs.mkdirSync(path.join(directoryPath, 'nested'));
    fs.symlinkSync('profile.pdf', path.join(directoryPath, 'profile-link.pdf'));
    fs.symlinkSync('nested', path.join(directoryPath, 'nested-link'));

    expect(readEntryKind('profile-link.pdf')).toBe('file');
    expect(readEntryKind('nested-link')).toBe('directory');
  });

  test('classifies broken symlinks as other', () => {
    fs.symlinkSync('missing.pdf', path.join(directoryPath, 'missing-link.pdf'));

    expect(readEntryKind('missing-link.pdf')).toBe('other');
  });

  test('classifies non-file directory entries as other', () => {
    const entry: fs.Dirent = {
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isDirectory: () => false,
      isFIFO: () => true,
      isFile: () => false,
      isSocket: () => false,
      isSymbolicLink: () => false,
      name: 'pipe',
      parentPath: directoryPath,
      path: directoryPath,
    };

    expect(getNodeDirectoryEntryKind(directoryPath, entry)).toBe('other');
  });

  function readEntryKind(
    fileName: string
  ): ReturnType<typeof getNodeDirectoryEntryKind> {
    const entry = fs
      .readdirSync(directoryPath, { withFileTypes: true })
      .find(candidate => candidate.name === fileName);

    if (entry === undefined) {
      throw new Error(`Missing test directory entry: ${fileName}`);
    }

    return getNodeDirectoryEntryKind(directoryPath, entry);
  }
});
