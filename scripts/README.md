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
| `inspect-pdf-source.mjs` | `pnpm run source:inspect -- <pdf>` | Builds first, then writes a source evidence bundle for one or more PDFs. Each bundle includes Poppler text, bbox XHTML, pdf metadata, pdfplumber words/chars, raw unpdf items, parser structural lines, parser JSON, source coverage reports, rendered page PNGs, and `overlay.html`. Supports positional PDF paths, `--samples <dir>`, and `--output <dir>`. | Gives a parser-independent view of the PDF plus the parser's own reconstruction so extraction bugs can be investigated from source geometry instead of trusting generated JSON. |
| `sample-completeness-audit.mjs` | `pnpm run samples:audit-coverage -- --samples samples/` | Compares layout-extracted sample text with matching sample JSON files by inferred source section, reports unmatched source segments, loose token-only matches, untraced output values, section coverage, and `section_parse_warning` entries. Supports `--samples <dir>`, `--layouts <dir>`, `--report <path>`, `--fail-on-unmatched`, `--fail-on-loose`, `--fail-on-untraced-output`, `--fail-on-section-warnings`, and `--strict`. | Helps identify PDF content missing from parsed JSON and JSON values that are not traceable to same-section source text. Treat reported items as review prompts because the section inference and matching remain heuristic. |

The layout extraction and completeness audit scripts require the Poppler
`pdftotext` executable. The source inspection script uses Poppler tools
(`pdftotext`, `pdfinfo`, `pdffonts`, `pdfimages`, and `pdftoppm`), `uvx` with
`pdfplumber`, and the built parser in `dist/`. The audit script will generate
missing layout text on demand, so it also depends on `pdftotext` unless the
requested layout files already exist.

## Shared helpers

- `lib/verification-helpers.mjs` provides shared path resolution, assertions,
  JSON reads, executable path handling, and synchronous command execution for
  build/package verification scripts.
- `lib/sample-script-helpers.mjs` provides shared sample-directory defaults,
  simple CLI option parsing, sorted PDF discovery, child-process execution, and
  `section_parse_warning` extraction for sample-oriented scripts.
- `lib/source-coverage-helpers.mjs` provides source-section inference, text
  normalization, same-section source-to-output coverage matching, and output
  traceability checks for PDF debugging scripts.

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
pnpm run samples:audit-coverage -- --samples samples/
```

When a single PDF needs deeper investigation, generate a source evidence bundle
and inspect `overlay.html`, `parser-lines.json`, `unpdf.items.json`, and the
source coverage reports:

```bash
pnpm run source:inspect -- samples/Achuta\ Kadambi.pdf
```

For package-release confidence, build first and then run the artifact, package,
and size checks:

```bash
pnpm run build
pnpm run verify:artifacts
pnpm run verify:package
pnpm run size:check
```
