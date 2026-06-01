# linkedin-parser-serverless

[![npm version](https://badge.fury.io/js/linkedin-parser-serverless.svg)](https://www.npmjs.com/package/linkedin-parser-serverless)
[![codecov](https://codecov.io/gh/hbmartin/linkedin-parser-serverless/graph/badge.svg?token=Po1nDYEr5f)](https://codecov.io/gh/hbmartin/linkedin-parser-serverless)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/linkedin-parser-serverless)](https://bundlephobia.com/package/linkedin-parser-serverless)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Context7](https://img.shields.io/badge/[]-Context7-059669)](https://context7.com/hbmartin/linkedin-parser-serverless)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hbmartin/linkedin-parser-serverless)

A clean, lightweight, serverless (e.g. Vercel Edge) TypeScript library for parsing LinkedIn PDF resumes and extracting structured profile data.

- [Features](#features)
- [🌐 Language Support](#-language-support)
- [📦 Installation](#-installation)
- [🖥️ CLI Usage](#️-cli-usage)
- [🚀 Quick Start](#-quick-start)
- [📚 Examples](#-examples)
- [📖 API Reference](#-api-reference)
- [🏗️ TypeScript Interfaces](#️-typescript-interfaces)
- [🛠️ Development](#️-development)
- [📊 Performance](#-performance)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## Features

- **Simple API**: Single function to parse PDF files or text
- **Serverless Friendly**: Uses `unpdf` for PDF text extraction across JavaScript runtimes
- **TypeScript First**: Full type definitions included
- **Fast**: Optimized parsing algorithms
- **Well Tested**: Comprehensive Jest test suite
- **ESM Ready**: Modern ES module support

## 🌐 Language Support

The parser preserves Unicode text from LinkedIn PDF exports, so names, headlines,
company names, titles, descriptions, skills, and education values can be returned
in their original language.

Localized parsing support is heuristic and field-specific:

- Section headers are recognized for English plus common LinkedIn labels in
  Portuguese, Spanish, French, Italian, Norwegian, and selected German labels.
- Date ranges recognize English, Portuguese, Spanish, French, German, Italian,
  Dutch, and Norwegian month or duration words where they appear in LinkedIn
  exports.
- The `languages` profile section accepts Unicode language names and common
  LinkedIn proficiency labels such as `Native or Bilingual`, `Professional
  Working`, `Limited Working`, and `Elementary`.

Unsupported localized labels usually produce partial results rather than fatal
errors. Check `warnings` and `diagnostics.sectionsFound` when working with a new
LinkedIn export locale, and use `includeRawText: true` if you need to inspect
the original extracted text.

## 📦 Installation

### Requirements

- Node.js 22.0.0 or newer
- pnpm 11.1.3 for local development
- Also runs on Vercel Edge and any serverless JavaScript runtime that provides Web-standard binary types such as `ArrayBuffer`

### Library Usage

```bash
npm install linkedin-parser-serverless
```

### CLI Usage (Global)

```bash
# Install globally for command-line usage
npm install -g linkedin-parser-serverless

# Or use with npx (no installation required)
npx -p linkedin-parser-serverless linkedin-pdf-parser path/to/resume.pdf
```

## 🖥️ CLI Usage

The package includes a command-line interface for easy PDF processing:

### Command

```bash
# Parse a LinkedIn PDF and output JSON
linkedin-pdf-parser ./resume.pdf

# Save output to file
linkedin-pdf-parser ./resume.pdf > profile.json

# Compact output (no pretty formatting)
linkedin-pdf-parser ./resume.pdf --compact

# Include raw extracted text
linkedin-pdf-parser ./resume.pdf --raw-text

# Create JSON baselines next to PDFs in a folder
linkedin-pdf-parser write-json ./fixtures

# Verify PDFs still generate the expected JSON baselines
linkedin-pdf-parser verify-json ./fixtures

# Print semantic JSON keypath changes for changed baselines
linkedin-pdf-parser verify-json ./fixtures --json-paths
```

### Real-world Examples

```bash
# Create or refresh regression baselines
linkedin-pdf-parser write-json ./customer-samples --force

# Check parser output after dependency or parser changes
linkedin-pdf-parser verify-json ./customer-samples

# Extract specific data with jq
linkedin-pdf-parser resume.pdf | jq '.profile.name'
linkedin-pdf-parser resume.pdf | jq '.profile.contact.email'
linkedin-pdf-parser resume.pdf | jq '.profile.experience[].company'
```

### CLI Options
- `--compact` - Compact JSON output (no formatting)
- `--force` - Overwrite existing JSON files in `write-json` mode
- `--json-paths` - Print semantic JSON keypath changes in `verify-json` mode
- `--raw-text` - Include raw extracted text in output
- `--help, -h` - Show help message

**📖 See [CLI_USAGE.md](CLI_USAGE.md) for complete CLI documentation**

**Note:** PDF extraction is powered by `unpdf`, which includes a serverless PDF.js build.

## 🚀 Quick Start

```typescript
import {
  formatLinkedInProfile,
  parseLinkedInPDF
} from 'linkedin-parser-serverless';
import fs from 'fs';

const pdfBuffer = fs.readFileSync('resume.pdf');
const { diagnostics, profile } = await parseLinkedInPDF(pdfBuffer);

console.log(`Name: ${profile.name}`);
console.log(`Email: ${profile.contact.email ?? 'not found'}`);
console.log(`Skills: ${profile.top_skills.join(', ')}`);
console.log(`Experience: ${profile.experience.length} positions`);
console.log(`Likely LinkedIn export: ${diagnostics.isLikelyLinkedInExport}`);
console.log(formatLinkedInProfile(profile));
```

### Sample Output

```json
{
  "profile": {
    "name": "Orion Helios",
    "headline": "Senior Backend Engineer at DataFlow Inc",
    "location": "Austin, Texas, United States",
    "contact": {
      "email": "orion.helios@example.com",
      "linkedin_url": "https://www.linkedin.com/in/orion-helios"
    },
    "top_skills": ["TypeScript", "Node.js", "AWS"],
    "certifications": ["AWS Certified Solutions Architect"],
    "volunteer_work": [],
    "projects": ["Search platform migration"],
    "publications": [],
    "languages": [
      {
        "language": "English",
        "proficiency": "Native or Bilingual"
      }
    ],
    "summary": "Backend engineer focused on high-volume data platforms and serverless APIs.",
    "experience": [
      {
        "title": "Senior Backend Engineer",
        "company": "DataFlow Inc",
        "duration": "January 2021 - Present",
        "location": "Austin, Texas, United States"
      },
      {
        "title": "Software Engineer",
        "company": "TechFlow Systems",
        "duration": "June 2018 - December 2020"
      }
    ],
    "education": [
      {
        "degree": "BS, Computer Science",
        "institution": "University of Texas at Austin",
        "year": "2014 - 2018"
      }
    ]
  },
  "warnings": [],
  "diagnostics": {
    "sectionsFound": ["summary", "experience", "education", "top_skills"],
    "confidence": 0.94,
    "isLikelyLinkedInExport": true,
    "isEmpty": false
  }
}
```

## 📚 Examples

### With Options

```typescript
// Include raw extracted text in result
const result = await parseLinkedInPDF(pdfData, {
  includeRawText: true
});

console.log(`Raw text: ${result.rawText?.substring(0, 100)}...`);
```

### Serverless Binary Input

```typescript
const arrayBuffer = await request.arrayBuffer();
const result = await parseLinkedInPDF(arrayBuffer);
```

### Vercel Edge Route

Create a Next.js App Router endpoint at `app/api/parse-linkedin/route.ts`:

```typescript
import { parseLinkedInPDF } from 'linkedin-parser-serverless';

export const runtime = 'edge';

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const resume = formData.get('resume');

  if (!(resume instanceof File)) {
    return Response.json(
      { error: 'Upload a PDF file in the "resume" form field.' },
      { status: 400 }
    );
  }

  const parsed = await parseLinkedInPDF(await resume.arrayBuffer());

  return Response.json(parsed);
}
```

Deploy it with Vercel and post a LinkedIn PDF to the Edge Function:

```bash
vercel deploy
curl -F "resume=@linkedin-resume.pdf" https://your-app.vercel.app/api/parse-linkedin
```

### Parse Text Directly

```typescript
// If you already have extracted text from PDF
const extractedText = "Orion Helios\nSoftware Engineer...";
const result = await parseLinkedInPDF(extractedText);
```

### Partial Results and Warnings

```typescript
const result = await parseLinkedInPDF(pdfData);

if (!result.diagnostics.isLikelyLinkedInExport) {
  console.warn('Input parsed, but does not look like a LinkedIn export.');
}

for (const warning of result.warnings) {
  console.warn(`${warning.field}: ${warning.message}`);
}

if (result.profile.contact.email) {
  console.log(result.profile.contact.email);
}
```

The parser throws only for fatal input failures such as empty or unreadable PDFs.
Missing profile fields are returned as partial results with structured warnings.

### Formatted Profile Summary

```typescript
import { formatLinkedInProfile, parseLinkedInPDF } from "linkedin-parser-serverless";

const { profile } = await parseLinkedInPDF(pdfData);
const notes = formatLinkedInProfile(profile, {
  includeContact: false,
  outputFormat: "markdown"
});
```

`formatLinkedInProfile` emits stable plain text by default, or Markdown when
`outputFormat: "markdown"` is set. Pass `includeContact: true` to include email,
phone, LinkedIn URL, and profile links.

### Strict and Safe Parsing

```typescript
import {
  LinkedInProfileParseError,
  parseLinkedInPDFStrict,
  safeParseLinkedInPDF
} from "linkedin-parser-serverless";

try {
  const result = await parseLinkedInPDFStrict(pdfData);
  console.log(result.diagnostics.confidence);
} catch (error) {
  if (error instanceof LinkedInProfileParseError) {
    console.warn(error.code);
  }
}

const safeResult = await safeParseLinkedInPDF(pdfData);
if (!safeResult.success) {
  console.warn(safeResult.error.code);
}
```

`parseLinkedInPDF` is lenient and does not throw for readable non-LinkedIn
input; inspect `diagnostics.isLikelyLinkedInExport` instead. `parseLinkedInPDFStrict`
adds runtime `ParseResultSchema` validation and throws `schema_validation_failed`
if the successful parse result does not match the public schema.

## 📖 API Reference

### `parseLinkedInPDF(input, options?)`

Parses a LinkedIn PDF resume and extracts structured profile data.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `ArrayBuffer \| Uint8Array \| string` | PDF binary data or extracted text string |
| `options?` | `ParseOptions` | Optional parsing configuration |

#### Returns

`Promise<ParseResult>` - Promise resolving to parsed profile data

#### Example

```typescript
const result = await parseLinkedInPDF(pdfData, { includeRawText: true });
```

### `parseLinkedInPDFStrict(input, options?)`

Parses the input with `parseLinkedInPDF`, then validates the successful result
with `ParseResultSchema`. Fatal parse errors and schema failures are thrown as
`LinkedInProfileParseError`.

### `safeParseLinkedInPDF(input, options?)`

Returns a discriminated result:

```typescript
type SafeParseLinkedInPDFResult =
  | { success: true; data: ParseResult }
  | { success: false; error: LinkedInProfileParseError };
```

### `formatLinkedInProfile(profile, options?)`

Formats a parsed `LinkedInProfile` as plain text or Markdown with stable section
headings and whitespace cleanup.

```typescript
type LinkedInProfileOutputFormat = "plainText" | "markdown";

interface FormatLinkedInProfileOptions {
  includeContact?: boolean;
  outputFormat?: LinkedInProfileOutputFormat;
}
```

## 🏗️ TypeScript Interfaces

<details>
<summary><strong>LinkedInProfile</strong></summary>

```typescript
interface LinkedInProfile {
  name?: string;
  headline?: string;
  location?: string;
  contact: Contact;
  top_skills: string[];
  languages: Language[];
  certifications: string[];
  volunteer_work: string[];
  projects: string[];
  publications: string[];
  honors_awards: string[];
  summary?: string;
  experience_groups: ExperienceGroup[];
  experience: Experience[];
  education: Education[];
}
```
</details>

<details>
<summary><strong>Contact</strong></summary>

```typescript
interface Contact {
  email?: string;
  phone?: string;
  linkedin_url?: string;
  location?: string;
}
```
</details>

<details>
<summary><strong>Experience</strong></summary>

```typescript
interface Experience {
  title: string;
  company: string;
  duration: string;
  dates?: ParsedDateRange;
  location?: string;
  description?: string;
}
```

</details>

See [Work Experience Semantics](docs/work-experience-semantics.md) for how repeated companies and multiple positions are interpreted.

<details>
<summary><strong>Education</strong></summary>

```typescript
interface Education {
  degree: string;
  institution: string;
  year?: string;
  dates?: ParsedDateRange;
  location?: string;
  description?: string;
}
```
</details>

<details>
<summary><strong>ParsedDateRange</strong></summary>

```typescript
interface ParsedProfileDate {
  iso: string;
  precision: "year" | "month" | "day";
  text: string;
}

type ParsedDateRange =
  | {
      kind: 'current';
      originalText: string;
      start: ParsedProfileDate;
      durationText?: string;
      end?: undefined;
    }
  | {
      kind: 'completed';
      originalText: string;
      start: ParsedProfileDate;
      end: ParsedProfileDate;
      durationText?: string;
    }
  | {
      kind: 'single';
      originalText: string;
      start: ParsedProfileDate;
      durationText?: string;
      end?: undefined;
    };
```
</details>

<details>
<summary><strong>Language</strong></summary>

```typescript
interface Language {
  language: string;
  proficiency: string;
}
```
</details>

<details>
<summary><strong>ParseOptions</strong></summary>

```typescript
interface ParseOptions {
  includeRawText?: boolean;
}
```
</details>

<details>
<summary><strong>ParseWarning</strong></summary>

```typescript
interface MissingProfileFieldWarning {
  code: 'missing_profile_field';
  field: 'profile.name' | 'profile.contact.email';
  message: string;
}

interface SectionParseWarning {
  code: 'section_parse_warning';
  section:
    | 'profile'
    | 'contact'
    | 'summary'
    | 'top_skills'
    | 'languages'
    | 'certifications'
    | 'volunteer_work'
    | 'projects'
    | 'publications'
    | 'honors_awards'
    | 'experience'
    | 'education';
  entry?: number;
  field: string;
  message: string;
  rawText?: string;
}

type ParseWarning = MissingProfileFieldWarning | SectionParseWarning;
```
</details>

<details>
<summary><strong>ParseDiagnostics</strong></summary>

```typescript
interface ParseDiagnostics {
  sectionsFound: WarningSection[];
  confidence: number;
  isLikelyLinkedInExport: boolean;
  isEmpty: boolean;
}
```
</details>

### Diagnostics fields explained

| Field | Type | Meaning |
|-------|------|---------|
| `sectionsFound` | `WarningSection[]` | Profile sections detected in the input — found by matching normalized section headers in the extracted text and by collecting the `section` of any `section_parse_warning`. The list is deduplicated; values come from the `WarningSection` union (`summary`, `experience`, `education`, `top_skills`, `languages`, etc.). |
| `confidence` | `number` (0–1) | Heuristic quality score, rounded to two decimals. Treat it as a relative indicator, not a probability — there is no fixed "good" threshold. See the scoring breakdown below. |
| `isLikelyLinkedInExport` | `boolean` | Whether the input looks like a LinkedIn "Save to PDF" export rather than an arbitrary document. **Use this — not `confidence` — to decide whether to trust the result as a LinkedIn profile.** True when the profile is non-empty *and* any of: a LinkedIn signal is present (a `linkedin_url`, or "linkedin" appears in the text), at least 2 sections were found, or at least one section was found with `confidence >= 0.5`. |
| `isEmpty` | `boolean` | True when no profile fields were extracted at all (no name, headline, location, summary, contact, list sections, experience, or education). Readable input that yields nothing returns `isEmpty: true` rather than throwing. |

**How `confidence` is computed.** It is `0` for an empty profile. Otherwise it is the sum of the weighted signals below, minus a warning penalty, clamped to `[0, 1]`:

| Signal | Contribution |
|--------|-------------|
| LinkedIn signal (`linkedin_url` present, or "linkedin" in the text) | +0.30 |
| Sections found | +0.06 each, capped at +0.25 |
| Name | +0.12 |
| Headline | +0.05 |
| Location | +0.05 |
| Any contact field (email, phone, LinkedIn URL, location, or links) | +0.10 |
| Has experience or experience groups | +0.15 |
| Has education | +0.10 |
| Any list section (skills, languages, certifications, projects, etc.) | +0.10 |
| Warning penalty | −0.02 per warning, capped at −0.15 |

<details>
<summary><strong>LinkedInProfileParseError</strong></summary>

```typescript
type LinkedInProfileParseErrorCode =
  | 'invalid_pdf'
  | 'encrypted_pdf'
  | 'unsupported_pdf'
  | 'not_linkedin_profile'
  | 'text_extraction_failed'
  | 'schema_validation_failed';

class LinkedInProfileParseError extends Error {
  code: LinkedInProfileParseErrorCode;
  cause?: unknown;
}
```
</details>

### Zod Schemas

The main entrypoint also exports named Zod schemas for runtime validation.
`parseLinkedInPDFStrict` validates successful results with `ParseResultSchema`;
plain `parseLinkedInPDF` returns the typed result without the extra validation step.

```typescript
import { LinkedInProfileSchema, ParseResultSchema, parseLinkedInPDFStrict } from "linkedin-parser-serverless";

const result = await parseLinkedInPDFStrict(pdfData);
const profile = LinkedInProfileSchema.parse(result.profile);
```

<details>
<summary><strong>ParseResult</strong></summary>

```typescript
interface ParseResult {
  profile: LinkedInProfile;
  warnings: ParseWarning[];
  diagnostics: ParseDiagnostics;
  rawText?: string;
}
```
</details>

## 🛠️ Development

```bash
# Clone repository
git clone https://github.com/hbmartin/linkedin-parser-serverless.git
cd linkedin-parser-serverless

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build library
pnpm run build

# Run tests with coverage
pnpm run test:coverage

# Clean build artifacts
pnpm run clean
```

### Codex PDF Debugging Skill

This repo includes a Codex skill for investigating sample PDF extraction issues:

```text
.agents/skills/debug-linkedin-sample-pdfs
```

Use it when parser output may be wrong and the original PDF needs to be treated as the source of truth.

In the Codex CLI, start from the repository root and ask Codex to use the skill explicitly:

```text
Use $debug-linkedin-sample-pdfs to investigate why samples/Persephone Kore.pdf parses incorrectly.
```

In the Codex app, use the same `$debug-linkedin-sample-pdfs` mention in the chat. The skill directs Codex to generate source evidence bundles with `pnpm run source:inspect -- <pdf>`, compare Poppler/pdfplumber/unpdf artifacts, and use the section-aware sample audit before changing parser code.

For a private sample corpus, place top-level PDFs in the local gitignored
`samples/` directory, then ask Codex to use the skill against the new set:

```text
Use $debug-linkedin-sample-pdfs to inspect my samples/ directory, identify parser gaps against the source PDFs, and improve the parser until pnpm run check and pnpm run samples:verify pass.
```

Codex will treat the PDFs as source truth, generate evidence bundles for
suspicious cases, add focused tests for any parser change, and use
`samples:verify` so another developer can iterate without committing private
files. If no JSON exists yet, `samples:verify` generates initial JSON first;
that generated JSON is suspect parser output for review, not golden truth.

### Developing and Testing the CLI

The local CLI script loads the built package from `dist/`, so build the project before running it from a checkout:

```bash
pnpm install
pnpm run build

# Run the local CLI directly against the included fixture
node bin/cli.js tests/fixtures/Profile.pdf

# Check compact output and raw text output
node bin/cli.js tests/fixtures/Profile.pdf --compact
node bin/cli.js tests/fixtures/Profile.pdf --raw-text

# Check usage output
node bin/cli.js --help
```

For a quick smoke test, assert a few expected fields with `jq`:

```bash
node bin/cli.js tests/fixtures/Profile.pdf | jq '.profile.name'
node bin/cli.js tests/fixtures/Profile.pdf | jq '.profile.contact.email'
node bin/cli.js tests/fixtures/Profile.pdf | jq '.profile.experience[0]'
```

## 📊 Performance

Measure performance against the checked-in fixtures with the built package:

```bash
pnpm run perf:measure -- --iterations 30 --warmup 10
```

A local run on Node v24.16.0 (`darwin/arm64`) produced:

| Input | Kind | Size | Average | Median | p95 | Max heap delta |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `Profile.pdf` | PDF | 49.25 KiB | 7.7ms | 7.7ms | 8.2ms | 7.62 MiB |
| `test_resume.pdf` | PDF | 81.30 KiB | 24.6ms | 24.6ms | 25.9ms | 35.51 MiB |
| `Profile.txt` | text | 1.54 KiB | 0.4ms | 0.4ms | 0.5ms | 471.70 KiB |
| `test_resume.txt` | text | 12.60 KiB | 1.8ms | 1.8ms | 1.9ms | 1.30 MiB |

PDF timings include `unpdf` extraction plus structural parsing. Text timings
start after text extraction. Heap deltas are the maximum heap growth observed
during a single measured parse; expect them to vary by Node version, platform,
fixture shape, and garbage-collection timing.

The package keeps runtime dependencies external. Current built artifact sizes:

| Artifact | Raw | Gzip |
| --- | ---: | ---: |
| `dist/index.js` | 249.37 KiB | 46.88 KiB |
| `dist/index.cjs` | 250.96 KiB | 47.15 KiB |
| `dist/index.min.js` | 108.38 KiB | 29.75 KiB |
| `dist/cli.js` | 28.83 KiB | 5.77 KiB |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](LICENSE) © [Harold Martin](mailto:harold.martin@gmail.com)

---

Originally made with ❤️ by [Arkady Zalkowitsch](https://github.com/zalkowitsch).

Currently maintained (with ❤️ of course!) by [Harold Martin](https://www.linkedin.com/in/harold-martin-98526971/).
