# linkedin-parser-serverless

[![npm version](https://badge.fury.io/js/linkedin-parser-serverless.svg)](https://www.npmjs.com/package/linkedin-parser-serverless)
[![codecov](https://codecov.io/gh/hbmartin/linkedin-parser-serverless/graph/badge.svg?token=Po1nDYEr5f)](https://codecov.io/gh/hbmartin/linkedin-parser-serverless)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/linkedin-parser-serverless)](https://bundlephobia.com/package/linkedin-parser-serverless)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Context7](https://img.shields.io/badge/[]-Context7-059669)](https://context7.com/hbmartin/linkedin-parser-serverless)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hbmartin/linkedin-parser-serverless)

<p>
  <img src="https://img.shields.io/npm/v/@zalko/linkedin-parser?style=flat-square&color=blue" alt="npm version" />
  <img src="https://img.shields.io/npm/dt/@zalko/linkedin-parser?style=flat-square&color=green" alt="downloads" />
  <img src="https://img.shields.io/badge/coverage-95.6%25-brightgreen?style=flat-square" alt="coverage" />
  <img src="https://img.shields.io/badge/bundle_size-3.0kB_gzipped-orange?style=flat-square" alt="bundle size" />
  <img src="https://img.shields.io/badge/node-18+-darkgreen?style=flat-square&logo=node.js" alt="node version" />
  <img src="https://img.shields.io/npm/types/@zalko/linkedin-parser?style=flat-square&color=blue" alt="typescript" />
  <img src="https://img.shields.io/npm/l/@zalko/linkedin-parser?style=flat-square&color=red" alt="license" />
</p>

**A clean, lightweight TypeScript library for parsing LinkedIn PDF resumes and extracting structured profile data.**

> ℹ️ **Note:** This is a newly published package. Download statistics may take 24-48 hours to populate. Some badges show "package not found or too new" until npm statistics are updated.

<p>
  <img src="https://img.shields.io/badge/tests-54_passing-success?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/github/commit-activity/m/zalkowitsch/linkedin-parser?style=flat-square&color=yellow" alt="activity" />
  <img src="https://img.shields.io/github/last-commit/zalkowitsch/linkedin-parser?style=flat-square&color=lightgrey" alt="last commit" />
</p>

[Installation](#installation) • [CLI Usage](#cli-usage) • [Quick Start](#quick-start) • [API Reference](#api-reference) • [Examples](#examples)

</div>

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

### Library Usage
```bash
npm install @zalko/linkedin-parser
```

### CLI Usage (Global)
```bash
# Install globally for command-line usage
npm install -g @zalko/linkedin-parser

# Or use with npx (no installation required)
npx @zalko/linkedin-parser path/to/resume.pdf
```

## 🖥️ CLI Usage

The package includes a command-line interface for easy PDF processing:

### Basic Usage
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
import { parseLinkedInPDF } from '@zalko/linkedin-parser';
import fs from 'fs';

// Parse from PDF binary data
const pdfBuffer = fs.readFileSync('resume.pdf');
const result = await parseLinkedInPDF(pdfBuffer);

console.log(result.profile.name);          // "John Silva"
console.log(result.profile.contact.email); // "john.silva@email.com"
console.log(result.profile.experience);    // [{ title: "...", company: "..." }]
```

## 📚 Examples

### Basic Usage

```typescript
import { parseLinkedInPDF } from '@zalko/linkedin-parser';
import fs from 'fs';

const pdfData = fs.readFileSync('linkedin-resume.pdf');
const { profile } = await parseLinkedInPDF(pdfData);

// Access parsed data
console.log(`Name: ${profile.name}`);
console.log(`Email: ${profile.contact.email}`);
console.log(`Skills: ${profile.top_skills.join(', ')}`);
console.log(`Experience: ${profile.experience.length} positions`);
```

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

**Work Experience Structure:**
- **Work Experience**: A continuous period of employment at an organization, even if the person returns to the same company later after working elsewhere
- **Organization/Company**: The employer entity (e.g., "TechCorp", "DataSystems Inc")
- **Position/Role**: The job title/role within that work experience period (e.g., "Engineering Manager", "Senior Developer")

**Examples:**

*Single organization, multiple positions:*
```
TechCorp (1 work experience, 3 positions):
- Engineering Manager
- Senior Developer
- Software Developer
```

*Same organization, separate work experiences:*
```
DataSystems Inc (2 separate work experiences, 2 positions):
1st work experience: Lead Engineer (2018-2020)
2nd work experience: Technical Architect (2023-Present)
// Note: Person worked elsewhere between 2020-2023
```

**Key principle:** If someone returns to the same company after working elsewhere, it counts as a separate work experience. This reflects career progression and different employment periods.

</details>

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
git clone https://github.com/zalkowitsch/linkedin-parser.git
cd linkedin-parser

# Install dependencies
npm install

# Run tests
npm test

# Build library
npm run build

# Run tests with coverage
npm run test:coverage

# Clean build artifacts
npm run clean
```

## 📊 Performance

- **Processing time**: ~70ms average for typical LinkedIn PDF
- **Memory usage**: Minimal memory footprint (~8MB)
- **Bundle size**: Ultra-lightweight at 3.0kB gzipped

## 🛡️ Quality & Trust

<table>
  <tr>
    <td align="center">🧪</td>
    <td><strong>Test Coverage</strong><br/>95.6% code coverage with comprehensive test suite</td>
  </tr>
  <tr>
    <td align="center">🔒</td>
    <td><strong>Security</strong><br/>Zero known vulnerabilities, regularly audited</td>
  </tr>
  <tr>
    <td align="center">📈</td>
    <td><strong>CI/CD</strong><br/>Automated testing and deployment pipeline</td>
  </tr>
  <tr>
    <td align="center">🏷️</td>
    <td><strong>Semantic Versioning</strong><br/>Follows semver for predictable releases</td>
  </tr>
  <tr>
    <td align="center">📝</td>
    <td><strong>Documentation</strong><br/>Comprehensive docs with TypeScript support</td>
  </tr>
  <tr>
    <td align="center">🚀</td>
    <td><strong>Production Ready</strong><br/>Battle-tested in production environments</td>
  </tr>
</table>

## 🌍 Compatibility

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square&logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?style=flat-square&logo=typescript)
![ES2022](https://img.shields.io/badge/ES2022-Compatible-orange?style=flat-square&logo=javascript)

</div>

**Supported Environments:**
- ✅ Node.js 18+ (ES2022 support)
- ✅ TypeScript 5.0+
- ✅ ESM (ES Modules)
- ✅ CommonJS (via build)
- ✅ Browsers (via bundlers)

**Package Managers:**
- ✅ npm 8+
- ✅ yarn 1.22+
- ✅ pnpm 7+

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](LICENSE) © [Arkady Zalkowitsch](mailto:arkady@zalko.com)

---

<div align="center">

**[⭐ Star this project](https://github.com/zalkowitsch/linkedin-parser)** if you find it helpful!

Made with ❤️ by [Arkady Zalkowitsch](https://github.com/zalkowitsch)

</div>
