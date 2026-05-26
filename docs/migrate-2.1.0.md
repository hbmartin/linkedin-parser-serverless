# Migrating to 2.1.0

2.1.0 keeps the main `parseLinkedInPDF` entrypoint and import path, but it
expands the public result shape and adds helpers for confidence checks, typed
errors, plain-text formatting, grouped work experience, and PDF source
debugging.

The most common migration work is updating TypeScript mocks, JSON fixtures, and
golden-file assertions that were written against the 2.0.0 result shape.

## Upgrade Checklist

1. Upgrade the package to `linkedin-parser-serverless@2.1.0`.
2. Update any stored `ParseResult` JSON to include top-level `diagnostics`.
3. Update any constructed `LinkedInProfile` values to include
   `experience_groups` and `honors_awards`.
4. Decide whether your integration should use lenient parsing
   (`parseLinkedInPDF`), schema-validated parsing (`parseLinkedInPDFStrict`), or
   no-throw parsing (`safeParseLinkedInPDF`).
5. If you validate parser output with Zod, update expected shapes for
   `ParseDiagnosticsSchema`, `ContactLinkSchema`, and `ExperienceGroupSchema`.
6. If you compare complete parser JSON, regenerate fixtures because parser
   heuristics now extract more contact links, honors/awards, grouped experience,
   dates, languages, education, and section warnings.

Node.js 22+ remains required. Local development in this repository now uses
`pnpm@11.1.3`.

## Result Shape Changes

`parseLinkedInPDF` still resolves to a `ParseResult`, but `diagnostics` is now a
required top-level field:

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

Use diagnostics as a routing signal, not as a perfect probability:

- `isLikelyLinkedInExport` is the best high-level accept/review flag.
- `confidence` is a bounded `0..1` parser confidence score.
- `sectionsFound` lists recognized LinkedIn-style sections such as
  `summary`, `experience`, `education`, and `top_skills`.
- `isEmpty` means the parser did not find usable profile content.

Readable PDFs or text that do not look like LinkedIn exports do not throw by
default. Fatal extraction failures still throw, including empty input, invalid
PDFs, encrypted PDFs, unsupported PDF features, and text that is too short to
parse.

## Profile Shape Changes

`LinkedInProfile` now has two additional required array fields:

```ts
interface LinkedInProfile {
  // Existing 2.0.0 fields remain.
  honors_awards: string[];
  experience_groups: ExperienceGroup[];
}
```

If your tests or application code construct profile objects manually, add empty
arrays when you do not have values:

```ts
const profile: LinkedInProfile = {
  contact: {},
  top_skills: [],
  languages: [],
  certifications: [],
  volunteer_work: [],
  projects: [],
  publications: [],
  honors_awards: [],
  experience_groups: [],
  experience: [],
  education: [],
};
```

`WarningSection` also includes `honors_awards`, so exhaustive switches over
warning sections must handle that value.

## Grouped Experience

2.0.0 exposed only `profile.experience`, a flat list where every role repeated
its company name. 2.1.0 adds `profile.experience_groups`, which preserves
LinkedIn's company grouping and organization-level total duration.

Prefer `experience_groups` when your UI or storage model needs company tenure,
multi-role progressions, or the distinction between one continuous employment
period and a later return to the same company:

```ts
for (const group of profile.experience_groups) {
  console.log(group.company, group.totalDuration);

  for (const position of group.positions) {
    console.log(position.title, position.duration);
  }
}
```

Keep using `profile.experience` when you need the old flat role list:

```ts
const flatRoles = profile.experience;
```

Both shapes describe the same parsed work history. The grouped representation is
the better long-term shape for new integrations. See
`docs/work-experience-semantics.md` for the exact continuity rules.

## Contact Links

`profile.contact` can now include normalized profile links:

```ts
interface Contact {
  email?: string;
  phone?: string;
  linkedin_url?: string;
  location?: string;
  links?: ContactLink[];
}

interface ContactLink {
  label?: string;
  rawText: string;
  url: string;
}
```

Use `contact.linkedin_url` for the canonical LinkedIn profile URL. Use
`contact.links ?? []` when you want all extracted links, including portfolios,
company links, blogs, or "Other" links from the LinkedIn contact section.

The parser now avoids treating digits inside URLs as phone numbers and removes a
phone number when it is just the numeric portion of a LinkedIn profile URL.

## Plain-Text Formatter

Use `formatLinkedInProfile` when callers need a compact text profile for notes,
search indexes, or downstream prompts:

```ts
import {
  formatLinkedInProfile,
  parseLinkedInPDF,
} from 'linkedin-parser-serverless';

const { profile } = await parseLinkedInPDF(pdfData);
const summaryText = formatLinkedInProfile(profile, {
  includeContact: false,
});
```

The formatter emits stable section headings, skips empty sections, and
normalizes whitespace. Contact details are omitted by default for privacy. Pass
`includeContact: true` to include email, phone, LinkedIn URL, location, and
profile links.

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

`not_linkedin_profile` is exported for integrations that want to enforce their
own diagnostics gate, but the built-in `parseLinkedInPDF` API does not throw it
for readable non-LinkedIn input. For example:

```ts
import {
  createLinkedInProfileParseError,
  parseLinkedInPDF,
} from 'linkedin-parser-serverless';

const result = await parseLinkedInPDF(input);

if (!result.diagnostics.isLikelyLinkedInExport) {
  throw createLinkedInProfileParseError({
    code: 'not_linkedin_profile',
  });
}
```

If you previously matched exact `Error.message` strings from 2.0.0, switch to
`error.code`. Messages are now more specific; for example, short text input
throws `text_extraction_failed` with `Input text is empty or too short`.

## Strict and Safe Parsing

`parseLinkedInPDF` remains the compatibility-first API. It returns partial
structured profiles when extraction is usable and does not perform an extra Zod
parse before returning.

Use `parseLinkedInPDFStrict` when you want every successful parse result to pass
`ParseResultSchema` before it is returned:

```ts
const result = await parseLinkedInPDFStrict(pdfData);
```

If the parsed result does not satisfy `ParseResultSchema`, strict parsing throws
`LinkedInProfileParseError` with code `schema_validation_failed`.

Use `safeParseLinkedInPDF` when your application prefers no-throw control flow:

```ts
const result = await safeParseLinkedInPDF(pdfData);

if (result.success) {
  console.log(result.data.profile.name);
} else {
  console.warn(result.error.code);
}
```

`safeParseLinkedInPDF` calls the strict parser internally, so its success branch
contains schema-validated output.

## Zod Schema Changes

`ParseResultSchema` now requires `diagnostics`, and the package exports
`ParseDiagnosticsSchema`.

`LinkedInProfileSchema` now requires `honors_awards` and `experience_groups`.
The package also exports:

- `ContactLinkSchema`
- `ExperienceGroupSchema`
- `ExperienceGroupPositionSchema`

Before:

```ts
const result = ParseResultSchema.parse(await parseLinkedInPDF(pdfData));
```

After, prefer the strict API:

```ts
const result = await parseLinkedInPDFStrict(pdfData);
```

Direct schema parsing still works if your JSON includes the new required
fields.

## Parser Output Differences To Expect

2.1.0 includes many extraction improvements. Existing fixtures can change even
when your input PDFs have not changed.

Expect more or different values in these areas:

- `profile.contact.links` and `profile.contact.linkedin_url`
- `profile.honors_awards`
- `profile.experience_groups` and flattened `profile.experience`
- `dates.durationText` for duration strings such as parenthetical durations or
  German `Jahr`/`Jahre`
- `profile.summary` for binary PDFs, because structural PDF parsing now uses an
  explicit Summary/About section instead of falling back to unrelated long
  lines
- `profile.languages`, especially wrapped values such as
  `Chinese (Traditional) (Limited Working)`
- `profile.education`, especially wrapped institutions, month/year ranges, and
  degree lines with embedded dates
- `warnings`, because contact warnings are suppressed when another structural
  parser resolves contact data and section warnings now include
  `honors_awards`

If you assert complete JSON equality, regenerate baselines after upgrading. If
you only need stable application behavior, prefer assertions around the fields
your application consumes.

## PDF Source Debugging

The package now exports `extractLinkedInPDFSourceDebug` for advanced debugging
of binary PDF extraction:

```ts
import { extractLinkedInPDFSourceDebug } from 'linkedin-parser-serverless';

const artifacts = await extractLinkedInPDFSourceDebug(pdfBytes);

console.log(artifacts.rawText);
console.log(artifacts.structuralLines);
```

It returns:

```ts
interface LinkedInPDFSourceDebugArtifacts {
  layout: LayoutInfo;
  rawText: string;
  structuralLines: StructuralLine[];
  textItems: TextItem[];
}
```

Use this when a PDF's visual layout and the parsed result disagree. It is most
useful for debugging or support tooling; normal application code should usually
call `parseLinkedInPDF`.

## CLI and Fixture Workflows

The CLI still supports the same main commands:

```bash
linkedin-pdf-parser ./resume.pdf
linkedin-pdf-parser write-json ./fixtures --force
linkedin-pdf-parser verify-json ./fixtures
```

Because the JSON shape changed, `verify-json` will report diffs until fixtures
are updated. Regenerate fixtures with `write-json --force` only after reviewing
that the new output is acceptable for your use case.

This repository also adds local sample verification commands for maintainers
and teams that keep a private sample corpus:

```bash
pnpm run samples:verify
pnpm run source:inspect -- samples/Profile.pdf
```

`samples/` is local and gitignored in this repository. The sample verifier can
bootstrap missing JSON for PDFs, but generated JSON is parser output to review,
not source truth.
