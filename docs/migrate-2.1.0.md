# Migrating to 2.1.0

This release adds consumer-facing helpers around parse confidence, plain-text
profile summaries, and typed failure handling while preserving the lenient
default parser behavior.

## Parse Results Now Include Diagnostics

`parseLinkedInPDF` still returns partial structured profiles when extraction is
usable, but successful results now include a required `diagnostics` object:

```ts
const result = await parseLinkedInPDF(pdfData);

if (!result.diagnostics.isLikelyLinkedInExport) {
  console.warn('Input parsed, but does not look like a LinkedIn export.');
}
```

The diagnostics shape is:

```ts
interface ParseDiagnostics {
  sectionsFound: WarningSection[];
  confidence: number;
  isLikelyLinkedInExport: boolean;
  isEmpty: boolean;
}
```

If you compare full JSON results in tests or fixtures, update expected output to
include `diagnostics`. Existing profile fields and warnings are unchanged.

## Non-LinkedIn Input Remains Lenient

Readable PDFs or text that do not look like LinkedIn exports do not throw by
default. Use `result.diagnostics.isLikelyLinkedInExport` and
`result.diagnostics.confidence` to separate likely LinkedIn exports from random
readable documents.

Fatal extraction failures still throw, including empty input, invalid PDFs,
encrypted PDFs, and unsupported PDF features.

## Plain-Text Formatter

Use `formatLinkedInProfile` when callers need a compact plain-text summary for
notes, search indexes, or downstream prompts:

```ts
import { formatLinkedInProfile, parseLinkedInPDF } from 'linkedin-parser-serverless';

const { profile } = await parseLinkedInPDF(pdfData);
const summaryText = formatLinkedInProfile(profile, {
  includeContact: false,
});
```

The formatter emits stable section headings, skips empty sections, and normalizes
whitespace. Contact details are omitted by default; pass `includeContact: true`
to include email, phone, LinkedIn URL, and profile links.

## Typed Errors

Thrown parser errors now subclass `LinkedInProfileParseError` and expose a
stable `code`:

```ts
import {
  LinkedInProfileParseError,
  parseLinkedInPDF,
} from 'linkedin-parser-serverless';

try {
  await parseLinkedInPDF(pdfData);
} catch (error) {
  if (error instanceof LinkedInProfileParseError) {
    console.warn(error.code);
  }
}
```

Current error codes are:

- `invalid_pdf`
- `encrypted_pdf`
- `unsupported_pdf`
- `not_linkedin_profile`
- `text_extraction_failed`
- `schema_validation_failed`

`not_linkedin_profile` is exported for strict workflows, but the default
`parseLinkedInPDF` API does not throw it for readable non-LinkedIn input.

## Strict and Safe Parsing

`parseLinkedInPDF` remains the compatibility-first API and does not perform an
extra runtime schema parse before returning. For callers that want runtime schema
validation built in, use `parseLinkedInPDFStrict`:

```ts
const result = await parseLinkedInPDFStrict(pdfData);
```

If the parsed result does not satisfy `ParseResultSchema`, strict parsing throws
`LinkedInProfileParseError` with code `schema_validation_failed`.

For no-throw control flow, use `safeParseLinkedInPDF`:

```ts
const result = await safeParseLinkedInPDF(pdfData);

if (result.success) {
  console.log(result.data.profile.name);
} else {
  console.warn(result.error.code);
}
```

## Zod Schema Changes

`ParseResultSchema` now requires `diagnostics`, and the package exports
`ParseDiagnosticsSchema`.

Before:

```ts
const result = ParseResultSchema.parse(await parseLinkedInPDF(pdfData));
```

After, prefer the strict API:

```ts
const result = await parseLinkedInPDFStrict(pdfData);
```

Direct schema parsing still works if your expected JSON includes `diagnostics`.

## Fixture Updates

If your project stores generated parser JSON as golden files, regenerate or edit
those baselines to include the new top-level `diagnostics` field. Local sample
verification will report diffs until those baselines are updated.
