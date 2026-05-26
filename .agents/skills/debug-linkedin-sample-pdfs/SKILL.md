---
name: debug-linkedin-sample-pdfs
description: Use automatically when working in this repo and the user or developer discusses a specific PDF file/path, sample PDF, parser JSON, generated JSON output, baseline JSON, or whether JSON accurately reflects the original PDF. Also use for LinkedIn PDF extraction bugs, parser misses, section or column errors, unpdf/pdfplumber/Poppler comparisons, source evidence bundles, and sample completeness audits.
---

# Debug LinkedIn Sample PDFs

Use source-derived artifacts as the authority. Parser JSON and sample baselines are useful regression outputs, but they are not proof of what the PDF contains.

Default to the repo-local `samples/` directory when the user does not provide a PDF path, sample directory, or specific parser symptom. Do not ask which PDF to inspect before running the default repo-wide sample pass.

## Workflow

1. If `samples/` contains PDFs but no JSON files yet, generate initial JSON before checking:

   ```bash
   pnpm run samples:verify
   ```

   The generated JSON is not golden output. Treat it as suspect parser output that exists only to make coverage, diffing, and review workflows possible. Debug questionable values against the original PDFs with CLI PDF tools and the scripts in `scripts/`.

2. Generate evidence before diagnosing. When no PDF path or sample directory is provided, inspect the repo-local `samples/` directory by default:

   ```bash
   pnpm run source:inspect
   ```

   For a specific PDF:

   ```bash
   pnpm run source:inspect -- <pdf-path>
   ```

   For a custom output folder:

   ```bash
   pnpm run source:inspect -- <pdf-path> --output .debug/<short-case-name>
   ```

3. Inspect source artifacts first:
   - `poppler.layout.txt` for readable columns and visible line order.
   - `overlay.html` for visual page geometry and text box placement.
   - `unpdf.items.json` for the extractor input the parser actually receives.
   - `pdfplumber.words.json` for independent word geometry.
   - `parser-lines.json` and `parser.structural.json` for parser reconstruction.
   - `parser-output.json` for current parser output, including `warnings` and `diagnostics`.
   - `parser-source-coverage.json` or `baseline-source-coverage.json` for section-aware coverage prompts.
   - `fieldMismatchOutputMatches` in coverage reports for high-confidence field-role mistakes inside a section, such as experience location or duration lines captured as descriptions.

4. Decide whether the failure is source extraction, layout reconstruction, section assignment, field parsing, or fixture expectation drift. Cite artifact filenames and source lines/items when explaining the diagnosis.

5. If changing parser behavior, add focused unit tests for the failing shape. Use a small synthetic text item or structural-line fixture unless the bug requires an end-to-end PDF fixture.

6. Run the repo-required verification after changes:

   ```bash
   pnpm run check
   pnpm run samples:verify
   ```

   `samples/` is local and gitignored, so `samples:verify` is intentionally separate from the default check. If no JSON files are present, `samples:verify` writes initial suspect JSON baselines before checking. After `samples:verify`, report its result and make no further changes from that output unless the user explicitly asks.

## Required Final Report

After using this skill, clearly document:

- Which PDF files produced incorrect or incomplete parser output, with the source evidence used to identify each problem.
- What code changes specifically address each failure case. Tie each fix to the PDF symptom it resolves rather than describing changes only by file name.
- How the generated JSON should appear different after the changes, including the fields or sections expected to be added, removed, moved, or normalized.
- Any `warnings` and `diagnostics` present in generated output JSON, including warnings that remain after the fix.
- Any generated JSON that remains suspect and still needs source-level review. Generated JSON is never golden output just because it was written by the CLI.

## Batch Audit

Use the section-aware audit to scan all samples or compare a candidate fix:

```bash
pnpm run samples:audit-coverage -- --samples samples/
```

Use strict mode when validating the local sample corpus:

```bash
pnpm run samples:audit-coverage -- --samples samples/ --strict
```

Strict mode fails on unmatched source, loose source matches, untraced output, high-confidence field mismatches, and section warnings. Treat `crossSectionOutputMatches` as informational review prompts: the output was traced to source text, but not in the section inferred from its JSON path. Treat `fieldMismatchOutputMatches` as stronger evidence: the output traces to the right broad section but the source line has an inferred field role that conflicts with the JSON path. Verify suspicious rows against `poppler.layout.txt`, `overlay.html`, and source geometry before changing parser code.

## Artifact Reference

Read [references/source-evidence.md](references/source-evidence.md) when you need artifact meanings, coverage-report interpretation, or a triage checklist.
