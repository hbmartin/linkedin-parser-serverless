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

For the investigation workflow and artifact interpretation, use the repo-local
skill at `.agents/skills/debug-linkedin-sample-pdfs`.

| Script | Package command | What it does | Why it is useful |
| --- | --- | --- | --- |
| `check-sample-warnings.mjs` | `pnpm run samples:check-warnings` | Parses every PDF in `samples/` with the built parser and fails if any output contains a `section_parse_warning`. | Gives a fast regression check for section parsing against real sample PDFs. |
| `extract-sample-layout-text.mjs` | none | Runs `pdftotext -layout` for each sample PDF and writes layout-preserving text files plus a manifest to `.debug-dist/sample-layout-text/` by default. Supports `--samples <dir>` and `--output <dir>`. | Makes PDF line layout visible when debugging column breaks, headings, contact blocks, or parser misses. |
| `inspect-pdf-source.mjs` | `pnpm run source:inspect` | Builds first, then writes a source evidence bundle for one or more PDFs, defaulting to `samples/` when no PDF path or `--samples` value is provided. Each bundle includes Poppler text, bbox XHTML, pdf metadata, pdfplumber words/chars, raw unpdf items, parser structural lines, parser JSON with warnings and diagnostics, source coverage reports, rendered page PNGs, and `overlay.html`. Supports positional PDF paths, `--samples <dir>`, and `--output <dir>`. | Gives a parser-independent view of the PDF plus the parser's own reconstruction so extraction bugs can be investigated from source geometry instead of trusting generated JSON. |
| `sample-completeness-audit.mjs` | `pnpm run samples:audit-coverage -- --samples samples/` | Compares layout-extracted sample text with matching sample JSON files by inferred source section, reports unmatched source segments, loose token-only matches, cross-section output matches, field-mismatch output matches, untraced output values, section coverage, and `section_parse_warning` entries. Supports `--samples <dir>`, `--layouts <dir>`, `--report <path>`, `--fail-on-unmatched`, `--fail-on-loose`, `--fail-on-field-mismatches`, `--fail-on-untraced-output`, `--fail-on-section-warnings`, and `--strict`. | Helps identify PDF content missing from parsed JSON, JSON values that are not traceable to source text, and same-section values assigned to the wrong field. Treat cross-section matches as review prompts because the section inference and matching remain heuristic. |
| `verify-samples.mjs` | `pnpm run samples:verify` | Builds once, generates initial suspect JSON when `samples/` has PDFs but no JSON files, verifies local sample JSON baselines with the built CLI, checks sample section warnings, and runs the strict completeness audit. Fails clearly when `samples/` is absent or has no PDFs. | Gives a single local robustness gate for the ignored `samples/` corpus without making `pnpm run check` depend on private sample files. Generated JSON is parser output for review, not golden truth. |

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

After that, run the local sample gate when `samples/` is available:

```bash
pnpm run samples:verify
```

When a sample PDF parses incorrectly, use the repo-local debugging skill. The
lowest-cost command-only workflow is:

```bash
node scripts/extract-sample-layout-text.mjs --samples samples/
pnpm run samples:audit-coverage -- --samples samples/ --strict
```

For deeper single-PDF investigation, generate a source evidence bundle:

```bash
pnpm run source:inspect
```

For package-release confidence, build first and then run the artifact, package,
and size checks:

```bash
pnpm run build
pnpm run verify:artifacts
pnpm run verify:package
pnpm run size:check
```
