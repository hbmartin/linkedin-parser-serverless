import { REGEX_PATTERNS } from './regex-patterns.js';

export function cleanPDFText(text: string): string {
  return text
    .replace(REGEX_PATTERNS.PAGE_NUMBERS, '')
    .replace(/[^\S\r\n]{2,}/g, ' ')
    .replace(REGEX_PATTERNS.BULLET_POINTS, '')
    .trim();
}

export function extractSection(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

export function splitLines(text: string): string[] {
  return text
    .split(REGEX_PATTERNS.LINE_BREAK)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

export function normalizeWhitespace(text: string): string {
  return text.replace(REGEX_PATTERNS.MULTIPLE_SPACES, ' ').trim();
}

export function extractFirstMatch(
  text: string,
  pattern: RegExp
): string | null {
  const match = text.match(pattern);
  return match ? match[0] : null;
}
