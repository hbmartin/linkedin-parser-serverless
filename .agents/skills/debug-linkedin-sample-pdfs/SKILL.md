---
name: debug-linkedin-sample-pdfs
description: Use when debugging LinkedIn PDF extraction in this repo, especially sample PDFs, parser misses, section or column errors, unpdf/pdfplumber/Poppler comparisons, source evidence bundles, sample completeness audits, or questions about whether parsed JSON accurately reflects the original PDF.
---

# Debug LinkedIn Sample PDFs

Use source-derived artifacts as the authority. Parser JSON and sample baselines are useful regression outputs, but they are not proof of what the PDF contains.

## Workflow

1. Generate evidence before diagnosing:

   ```bash
   pnpm run source:inspect -- <pdf-path>
   ```

   For a custom output folder:

   ```bash
   pnpm run source:inspect -- <pdf-path> --output .debug/<short-case-name>
   ```

2. Inspect source artifacts first:
   - `poppler.layout.txt` for readable columns and visible line order.
   - `overlay.html` for visual page geometry and text box placement.
   - `unpdf.items.json` for the extractor input the parser actually receives.
   - `pdfplumber.words.json` for independent word geometry.
   - `parser-lines.json` and `parser.structural.json` for parser reconstruction.
   - `parser-source-coverage.json` or `baseline-source-coverage.json` for section-aware coverage prompts.

3. Decide whether the failure is source extraction, layout reconstruction, section assignment, field parsing, or fixture expectation drift. Cite artifact filenames and source lines/items when explaining the diagnosis.

4. If changing parser behavior, add focused unit tests for the failing shape. Use a small synthetic text item or structural-line fixture unless the bug requires an end-to-end PDF fixture.

5. Run the repo-required verification after changes:

   ```bash
   pnpm run check
   pnpm cli verify-json samples/
   ```

   After `verify-json`, report its result and make no further changes from that output unless the user explicitly asks.

## Batch Audit

Use the section-aware audit to scan all samples or compare a candidate fix:

```bash
pnpm run samples:audit-coverage -- --samples samples/
```

Useful strict flags:

```bash
pnpm run samples:audit-coverage -- --samples samples/ --strict
```

Treat audit findings as review prompts. Section inference is heuristic, so verify suspicious rows against `poppler.layout.txt`, `overlay.html`, and source geometry before changing parser code.

## Artifact Reference

Read [references/source-evidence.md](references/source-evidence.md) when you need artifact meanings, coverage-report interpretation, or a triage checklist.
