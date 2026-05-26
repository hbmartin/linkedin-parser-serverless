# Scripts

This directory contains repository-maintenance scripts that supplement the unit
tests. They are most useful when checking build artifacts, package behavior,
bundle size, and real LinkedIn PDF samples during parser debugging.

Run commands from the repository root unless noted otherwise.

## Verification scripts

| Script | Package command | What it checks | Why it is useful |
| --- | --- | --- | --- |
| `verify-artifacts.mjs` | `pnpm run verify:artifacts` | Confirms the expected `dist/` and `bin/` files exist, validates `package.json` entrypoints, verifies external dependencies stay external, imports ESM/CJS/minified bundles, and exercises the CLI entrypoint. | Catches broken builds, export-map regressions, missing declarations, and CLI packaging mistakes before publish. |
| `verify-packed-package.mjs` | `pnpm run verify:package` | Runs `npm pack`, installs the packed archive into a temporary consumer project, then verifies ESM import, CJS require, TypeScript types, and the installed CLI. | Tests the package the way downstream users consume it, not just the local workspace files. |
| `check-size-budget.mjs` | `pnpm run size:check` | Checks raw and gzip size budgets for generated JavaScript artifacts and ensures the minified bundle is smaller than the regular bundle. | Prevents accidental bundle growth and catches minification or bundling regressions. |

These scripts assume `dist/` exists. Run `pnpm run build` first when invoking
them directly.

## Sample and PDF debugging scripts

| Script | Package command | What it does | Why it is useful |
| --- | --- | --- | --- |
| `check-sample-warnings.mjs` | `pnpm run samples:check-warnings` | Parses every PDF in `samples/` with the built parser and fails if any output contains a `section_parse_warning`. | Gives a fast regression check for section parsing against real sample PDFs. |
| `extract-sample-layout-text.mjs` | none | Runs `pdftotext -layout` for each sample PDF and writes layout-preserving text files plus a manifest to `.debug-dist/sample-layout-text/` by default. Supports `--samples <dir>` and `--output <dir>`. | Makes PDF line layout visible when debugging column breaks, headings, contact blocks, or parser misses. |
| `sample-completeness-audit.mjs` | none | Compares layout-extracted sample text with the matching sample JSON files, reports heuristic unmatched lines, records `section_parse_warning` entries, and writes `.debug-dist/sample-completeness-audit.json` by default. Supports `--samples <dir>`, `--layouts <dir>`, `--report <path>`, `--fail-on-unmatched`, `--fail-on-section-warnings`, and `--strict`. | Helps identify content present in the PDF that may not be represented in parsed JSON. Treat unmatched lines as review prompts because the matching is heuristic. |

The layout extraction and completeness audit scripts require the Poppler
`pdftotext` executable. The audit script will generate missing layout text on
demand, so it also depends on `pdftotext` unless the requested layout files
already exist.

## Shared helpers

- `lib/verification-helpers.mjs` provides shared path resolution, assertions,
  JSON reads, executable path handling, and synchronous command execution for
  build/package verification scripts.
- `lib/sample-script-helpers.mjs` provides shared sample-directory defaults,
  simple CLI option parsing, sorted PDF discovery, child-process execution, and
  `section_parse_warning` extraction for sample-oriented scripts.

## Typical workflows

After parser or build changes, run the standard repository check:

```bash
pnpm run check
```

After that, verify sample JSON baselines:

```bash
pnpm cli verify-json samples/
```

When a sample PDF parses incorrectly, inspect the layout text and then run the
completeness audit:

```bash
node scripts/extract-sample-layout-text.mjs --samples samples/
node scripts/sample-completeness-audit.mjs --samples samples/
```

For package-release confidence, build first and then run the artifact, package,
and size checks:

```bash
pnpm run build
pnpm run verify:artifacts
pnpm run verify:package
pnpm run size:check
```
