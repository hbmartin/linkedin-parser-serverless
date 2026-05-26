# Source Evidence Reference

## Artifact Inventory

- `manifest.json`: Bundle index and tool failures. Check this first.
- `pdfinfo.txt`: Page count, producer, metadata, encryption, and page size.
- `pdffonts.txt`: Embedded font data; useful for odd glyph or spacing behavior.
- `pdfimages.txt`: Confirms whether visible content is text or image-backed.
- `poppler.layout.txt`: Best first read for visible line order and column breaks.
- `poppler.raw.txt`: Poppler extraction without layout preservation.
- `poppler.bbox.xhtml`: Poppler word and block coordinates.
- `pdfplumber.words.json`: Independent word-level geometry with font and size.
- `pdfplumber.chars.json`: Character-level geometry for split glyphs, ligatures, or wrapped tokens.
- `unpdf.items.json`: Raw unpdf/PDF.js text items before parser normalization.
- `parser.structural.json`: Parser debug export with detected layout, raw text, text items, and structural lines.
- `parser-lines.json`: Reconstructed structural lines consumed by section parsers.
- `parser-output.json`: Current parser output with `rawText`, `warnings`, and `diagnostics`.
- `source-segments.json`: Poppler layout text split into inferred source sections.
- `parser-source-coverage.json`: Source coverage of the current parser output.
- `baseline-source-coverage.json`: Source coverage of the adjacent sample JSON baseline, when present.
- `page-*.png`: Rendered pages used by the overlay.
- `overlay.html`: Rendered pages with unpdf text item boxes overlaid.

## Coverage Signals

- `unmatchedSourceSegments`: PDF text in an inferred source section that did not appear in same-section JSON. Verify before changing code; common causes are section inference mistakes, parser omissions, or intentionally unmodeled fields.
- `looseSourceMatches`: Source matched only by token containment, not exact normalized text. Use these to find punctuation, spacing, URL wrapping, or normalization issues.
- `crossSectionOutputMatches`: JSON values traced to PDF text in a different inferred section. Treat these as review prompts for section inference or intentional duplicated content, not as untraced output failures.
- `fieldMismatchOutputMatches`: JSON values traced to the same inferred section but to a source line with a conflicting field role. These are high-confidence prompts for values like standalone experience locations or dates being captured as descriptions.
- `untracedOutputValues`: JSON values not traceable to same-section PDF text. These can reveal hallucinated/misassigned fields, normalized URLs, derived date fields, or text assigned to the wrong section.
- `sectionWarnings`: Parser warnings from generated or baseline JSON. Treat `section_parse_warning` as higher priority than heuristic coverage noise.
- `warnings` and `diagnostics`: Parser self-reporting in output JSON. Include these in the investigation notes even when the visible source text looks correct.

## Triage Checklist

1. Confirm visible truth in `poppler.layout.txt` and `overlay.html`.
2. Compare Poppler, pdfplumber, and unpdf geometry if text is missing or split unexpectedly.
3. Compare `unpdf.items.json` to `parser-lines.json` when columns, page transitions, or wrapped lines are wrong.
4. Check `fieldMismatchOutputMatches` before accepting section coverage as sufficient; a same-section match can still be a field-level parse error.
5. Compare `parser-lines.json` to `parser-output.json` when parser input is correct but fields are wrong.
6. Use `baseline-source-coverage.json` only to audit fixture completeness; do not treat the baseline as source truth.
7. Keep generated artifacts in `.debug/` for ad hoc investigation and `.debug-dist/` for reproducible script output.
