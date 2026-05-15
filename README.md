# linkedin-parser-serverless

[![npm version](https://badge.fury.io/js/linkedin-parser-serverless.svg)](https://www.npmjs.com/package/linkedin-parser-serverless)
[![codecov](https://codecov.io/gh/hbmartin/linkedin-parser-serverless/graph/badge.svg?token=Po1nDYEr5f)](https://codecov.io/gh/hbmartin/linkedin-parser-serverless)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/linkedin-parser-serverless)](https://bundlephobia.com/package/linkedin-parser-serverless)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Context7](https://img.shields.io/badge/[]-Context7-059669)](https://context7.com/hbmartin/linkedin-parser-serverless)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hbmartin/linkedin-parser-serverless)

A clean, lightweight, serverless (e.g. Vercel Edge) TypeScript library for parsing LinkedIn PDF resumes and extracting structured profile data.

[Installation](#installation) • [CLI Usage](#cli-usage) • [Quick Start](#quick-start) • [Examples](#examples) • [API Reference](#api-reference) • [Development](#development)

---

## ✨ Features

<table>
  <tr>
    <td align="center">🚀</td>
    <td><strong>Simple API</strong><br/>Single function to parse PDF files or text</td>
  </tr>
  <tr>
    <td align="center">📦</td>
    <td><strong>Serverless Friendly</strong><br/>Uses <code>unpdf</code> for PDF text extraction across JavaScript runtimes</td>
  </tr>
  <tr>
    <td align="center">🔧</td>
    <td><strong>TypeScript First</strong><br/>Full type definitions included</td>
  </tr>
  <tr>
    <td align="center">⚡</td>
    <td><strong>Fast</strong><br/>Optimized parsing algorithms</td>
  </tr>
  <tr>
    <td align="center">🧪</td>
    <td><strong>Well Tested</strong><br/>Comprehensive Jest test suite</td>
  </tr>
  <tr>
    <td align="center">📱</td>
    <td><strong>ESM Ready</strong><br/>Modern ES module support</td>
  </tr>
</table>

## 📦 Installation

### Requirements

- Node.js 22.0.0 or newer
- pnpm 11.1.2 for local development
- Supported runtimes: Node.js 22+, Vercel Edge, and serverless JavaScript runtimes that provide Web-standard binary types such as `ArrayBuffer`

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
```

### Real-world Examples
```bash
# Process multiple PDFs
for pdf in *.pdf; do
  linkedin-pdf-parser "$pdf" > "${pdf%.pdf}.json"
done

# Extract specific data with jq
linkedin-pdf-parser resume.pdf | jq '.profile.name'
linkedin-pdf-parser resume.pdf | jq '.profile.contact.email'
linkedin-pdf-parser resume.pdf | jq '.profile.experience[].company'
```

### CLI Options
- `--compact` - Compact JSON output (no formatting)
- `--raw-text` - Include raw extracted text in output
- `--help, -h` - Show help message

**📖 See [CLI_USAGE.md](CLI_USAGE.md) for complete CLI documentation**

**Note:** PDF extraction is powered by `unpdf`, which includes a serverless PDF.js build.

## 🚀 Quick Start

```typescript
import { parseLinkedInPDF } from 'linkedin-parser-serverless';
import fs from 'fs';

const pdfBuffer = fs.readFileSync('resume.pdf');
const { profile } = await parseLinkedInPDF(pdfBuffer);

console.log(`Name: ${profile.name}`);
console.log(`Email: ${profile.contact.email}`);
console.log(`Skills: ${profile.top_skills.join(', ')}`);
console.log(`Experience: ${profile.experience.length} positions`);
```

### Sample Output

```json
{
  "profile": {
    "name": "John Silva",
    "headline": "Senior Backend Engineer at DataFlow Inc",
    "location": "Austin, Texas, United States",
    "contact": {
      "email": "john.silva@email.com",
      "linkedin_url": "https://www.linkedin.com/in/john-silva"
    },
    "top_skills": ["TypeScript", "Node.js", "AWS"],
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
const extractedText = "John Silva\nSoftware Engineer...";
const result = await parseLinkedInPDF(extractedText);
```

### Error Handling

```typescript
try {
  const result = await parseLinkedInPDF(pdfData);
  console.log(result.profile);
} catch (error) {
  if (error.message === 'PDF appears to be empty or unreadable') {
    console.error('Invalid PDF file');
  } else {
    console.error('Parsing failed:', error.message);
  }
}
```

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

## 🏗️ TypeScript Interfaces

<details>
<summary><strong>LinkedInProfile</strong></summary>

```typescript
interface LinkedInProfile {
  name: string;
  headline: string;
  location: string;
  contact: Contact;
  top_skills: string[];
  languages: Language[];
  summary?: string;
  experience: Experience[];
  education: Education[];
}
```
</details>

<details>
<summary><strong>Contact</strong></summary>

```typescript
interface Contact {
  email: string;
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
  location?: string;
  description?: string;
}
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
<summary><strong>ParseResult</strong></summary>

```typescript
interface ParseResult {
  profile: LinkedInProfile;
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

### Developing and Testing the CLI

The local CLI script loads the built package from `dist/`, so build the project before running it from a checkout:

```bash
pnpm install
pnpm run build

# Run the local CLI directly against the included fixture
node bin/cli.js Profile.pdf

# Check compact output and raw text output
node bin/cli.js Profile.pdf --compact
node bin/cli.js Profile.pdf --raw-text

# Check usage output
node bin/cli.js --help
```

For a quick smoke test, assert a few expected fields with `jq`:

```bash
node bin/cli.js Profile.pdf | jq '.profile.name'
node bin/cli.js Profile.pdf | jq '.profile.contact.email'
node bin/cli.js Profile.pdf | jq '.profile.experience[0]'
```

## 📊 Performance

- **Processing time**: ~70ms average for typical LinkedIn PDF
- **Memory usage**: Minimal memory footprint (~8MB)
- **Bundle size**: Ultra-lightweight at 3.0kB gzipped


## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](LICENSE) © [Arkady Zalkowitsch](mailto:arkady@zalko.com)

---

Made with ❤️ by [Arkady Zalkowitsch](https://github.com/zalkowitsch) and Harold Martin
