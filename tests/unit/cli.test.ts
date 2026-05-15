import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import { main, runCli, type CliResult } from '../../src/cli.js';

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
      stderr: expect.stringContaining(
        'Usage: linkedin-pdf-parser <pdf-file-path> [options]'
      ),
      stdout: '',
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

    await main(['--help']);

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Usage: linkedin-pdf-parser <pdf-file-path> [options]'
      )
    );
  });

  test('writes parse output through the executable main entry point', async () => {
    const stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await main([profilePdfPath, '--compact']);

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\{"profile":/)
    );
  });

  test('reports parser failures', async () => {
    const result = await runCli({
      args: [profilePdfPath],
      dependencies: {
        fileExists: () => true,
        parsePdf: async () => {
          throw new Error('parse failed');
        },
        readFile: () => new Uint8Array([1, 2, 3]),
        resolvePath: filePath => filePath,
      },
    });

    expect(result).toEqual({
      exitCode: 1,
      stderr: 'Error: parse failed\n',
      stdout: '',
    });
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
