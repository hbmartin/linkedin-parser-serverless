import {
  sampleVerificationSteps,
  verifySamples,
} from '../../scripts/verify-samples.mjs';

interface FakeDirectoryEntry {
  kind: 'directory' | 'file' | 'other';
  name: string;
}

interface FakeCommandInvocation {
  args: string[];
  command: string;
}

interface FakeCommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

interface FakeDependenciesParams {
  entries?: FakeDirectoryEntry[];
  exists?: boolean;
  results?: FakeCommandResult[];
}

function fakeDependencies({
  entries = [],
  exists = true,
  results = [],
}: FakeDependenciesParams = {}): {
  commands: FakeCommandInvocation[];
  dependencies: {
    directoryExists: () => Promise<boolean>;
    listDirectory: () => Promise<FakeDirectoryEntry[]>;
    runCommand: (command: FakeCommandInvocation) => Promise<FakeCommandResult>;
  };
} {
  const commands: FakeCommandInvocation[] = [];
  const queuedResults = [...results];

  return {
    commands,
    dependencies: {
      async directoryExists() {
        return exists;
      },
      async listDirectory() {
        return entries;
      },
      async runCommand(command) {
        commands.push(command);

        return (
          queuedResults.shift() ?? {
            exitCode: 0,
            stderr: '',
            stdout: `${command.command} ${command.args.join(' ')} ok\n`,
          }
        );
      },
    },
  };
}

const samplePairEntries: FakeDirectoryEntry[] = [
  {
    kind: 'file',
    name: 'Profile.pdf',
  },
  {
    kind: 'file',
    name: 'Profile.json',
  },
];

describe('sample verification wrapper', () => {
  test('uses one build and then built sample verification commands', () => {
    expect(sampleVerificationSteps('samples')).toEqual([
      {
        args: ['run', 'build'],
        command: 'pnpm',
        label: 'Build package',
        stopOnFailure: true,
      },
      {
        args: ['bin/cli.js', 'verify-json', 'samples'],
        command: 'node',
        label: 'Verify sample JSON baselines',
        stopOnFailure: false,
      },
      {
        args: ['scripts/check-sample-warnings.mjs', '--samples', 'samples'],
        command: 'node',
        label: 'Check sample section warnings',
        stopOnFailure: false,
      },
      {
        args: [
          'scripts/sample-completeness-audit.mjs',
          '--samples',
          'samples',
          '--strict',
        ],
        command: 'node',
        label: 'Audit sample source coverage',
        stopOnFailure: false,
      },
    ]);
  });

  test('adds a suspect JSON generation step when bootstrapping PDFs', () => {
    expect(
      sampleVerificationSteps('samples', { shouldGenerateJson: true })
    ).toEqual([
      {
        args: ['run', 'build'],
        command: 'pnpm',
        label: 'Build package',
        stopOnFailure: true,
      },
      {
        args: ['bin/cli.js', 'write-json', 'samples'],
        command: 'node',
        label: 'Generate suspect sample JSON baselines',
        stopOnFailure: true,
      },
      {
        args: ['bin/cli.js', 'verify-json', 'samples'],
        command: 'node',
        label: 'Verify sample JSON baselines',
        stopOnFailure: false,
      },
      {
        args: ['scripts/check-sample-warnings.mjs', '--samples', 'samples'],
        command: 'node',
        label: 'Check sample section warnings',
        stopOnFailure: false,
      },
      {
        args: [
          'scripts/sample-completeness-audit.mjs',
          '--samples',
          'samples',
          '--strict',
        ],
        command: 'node',
        label: 'Audit sample source coverage',
        stopOnFailure: false,
      },
    ]);
  });

  test('fails before commands when the local samples directory is absent', async () => {
    const { commands, dependencies } = fakeDependencies({ exists: false });

    const result = await verifySamples({
      dependencies,
      samplesDir: 'samples',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Sample directory not found');
    expect(result.stderr).toContain('local and gitignored');
    expect(commands).toEqual([]);
  });

  test('fails before commands when there are no matching PDF JSON pairs', async () => {
    const { commands, dependencies } = fakeDependencies({
      entries: [
        {
          kind: 'file',
          name: 'OnlyPdf.pdf',
        },
        {
          kind: 'file',
          name: 'OnlyJson.json',
        },
      ],
    });

    const result = await verifySamples({
      dependencies,
      samplesDir: 'samples',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No matching PDF/JSON sample pairs');
    expect(result.stderr).toContain('Found 1 PDF file(s) and 1 JSON file(s)');
    expect(commands).toEqual([]);
  });

  test('runs all sample checks after a successful build', async () => {
    const { commands, dependencies } = fakeDependencies({
      entries: samplePairEntries,
    });

    const result = await verifySamples({
      dependencies,
      samplesDir: 'samples',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Local sample verification passed.');
    expect(commands).toEqual(
      sampleVerificationSteps('samples').map(({ args, command }) => ({
        args,
        command,
      }))
    );
    expect(commands.filter(command => command.command === 'pnpm')).toHaveLength(
      1
    );
  });

  test('generates suspect JSON when PDFs exist without JSON baselines', async () => {
    const { commands, dependencies } = fakeDependencies({
      entries: [
        {
          kind: 'file',
          name: 'Profile.pdf',
        },
      ],
    });

    const result = await verifySamples({
      dependencies,
      samplesDir: 'samples',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Generate suspect sample JSON baselines');
    expect(commands).toEqual(
      sampleVerificationSteps('samples', { shouldGenerateJson: true }).map(
        ({ args, command }) => ({
          args,
          command,
        })
      )
    );
  });

  test('aggregates non-build sample command failures', async () => {
    const { commands, dependencies } = fakeDependencies({
      entries: samplePairEntries,
      results: [
        {
          exitCode: 0,
          stderr: '',
          stdout: 'build ok\n',
        },
        {
          exitCode: 1,
          stderr: 'verify-json failed\n',
          stdout: '',
        },
        {
          exitCode: 0,
          stderr: '',
          stdout: 'warnings ok\n',
        },
        {
          exitCode: 2,
          stderr: 'audit failed\n',
          stdout: '',
        },
      ],
    });

    const result = await verifySamples({
      dependencies,
      samplesDir: 'samples',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'Verify sample JSON baselines exited with code 1'
    );
    expect(result.stderr).toContain(
      'Audit sample source coverage exited with code 2'
    );
    expect(commands).toHaveLength(4);
  });
});
