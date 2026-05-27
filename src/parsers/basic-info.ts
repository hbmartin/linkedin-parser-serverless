import { REGEX_PATTERNS } from '../utils/regex-patterns.js';
import {
  extractSection,
  splitLines,
  normalizeWhitespace,
} from '../utils/text-utils.js';
import {
  isLikelyLocationText,
  isSectionHeaderText,
  looksLikeOrganizationNameText,
  looksLikePersonNameText,
  looksLikePositionTitleText,
} from '../utils/profile-text.js';
import type {
  Contact as ProfileContact,
  ContactLink,
  ParsedSectionResult,
  SectionParseWarning,
} from '../types/profile.js';
import {
  createTextParserLines,
  getParserLineSectionHeader,
  type NormalizedParserLine,
} from '../utils/parser-lines.js';
import { extractStructuralSectionLines } from '../utils/structural-sections.js';
import type { StructuralLine } from '../utils/structural-lines.js';

export type Contact = ProfileContact;

export interface BasicInfo {
  name?: string;
  headline?: string;
  location?: string;
  summary?: string;
  contact: Contact;
}

type BasicInfoState =
  | 'seeking_name'
  | 'seeking_headline'
  | 'seeking_location'
  | 'in_summary';

const LOWERCASE_NAME_CONNECTORS = new Set([
  'al',
  'bin',
  'binti',
  'da',
  'das',
  'de',
  'del',
  'della',
  'den',
  'der',
  'di',
  'do',
  'dos',
  'du',
  'e',
  'el',
  'la',
  'le',
  'van',
  'von',
  'y',
]);

const EMAIL_SEARCH_LINE_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}$/i;
const LABELED_EMAIL_SEARCH_LINE_PATTERN =
  /^(?:e-?mail|mail)(?:\s*[:-]\s*|\s+)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}$/i;
const WRAPPED_EMAIL_START_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.$/i;
const EMAIL_TLD_CONTINUATION_PATTERN = /^[A-Z]{2,24}$/i;
const CONTACT_LINK_LABEL_PATTERN = /\(([\p{L}][\p{L}\p{N} &/+.-]{1,40})\)\s*$/u;
const PHONE_LINE_LABEL_PATTERN =
  /\s*\((?:mobile|work|phone|tel|telephone)\)\s*$/iu;

interface ContactLinkDraft {
  label?: string;
  parts: string[];
  rawLines: string[];
}

interface ContactSearchLines {
  emailSearchLines: string[];
  linkSearchLines: string[];
}

export class BasicInfoParser {
  static parse(text: string): BasicInfo {
    return this.parseWithWarnings(text).value;
  }

  static parseWithWarnings(text: string): ParsedSectionResult<BasicInfo> {
    const value: BasicInfo = {
      name: this.extractName(text),
      headline: this.extractHeadline(text),
      location: this.extractLocation(text),
      summary: this.extractSummary(text),
      contact: this.extractContact(text),
    };

    return {
      value,
      warnings: this.createBasicInfoWarnings(text, value),
    };
  }

  static parseStructuralWithWarnings(
    text: string,
    structuralLines: StructuralLine[]
  ): ParsedSectionResult<BasicInfo> {
    const value: BasicInfo = {
      name: this.extractName(text),
      headline: this.extractHeadline(text),
      location: this.extractLocation(text),
      summary: this.extractStructuralSummary(structuralLines),
      contact: this.extractStructuralContact(text, structuralLines),
    };

    return {
      value,
      warnings: this.createBasicInfoWarnings(text, value),
    };
  }

  private static extractName(text: string): string | undefined {
    const lines = splitLines(text);

    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const name = this.extractNameFromLine(lines[i]);

      if (name) {
        return name;
      }
    }

    return undefined;
  }

  private static extractNameFromLine(line: string): string | undefined {
    const normalizedLine = normalizeWhitespace(line);

    if (!this.isNameSearchLine(normalizedLine)) {
      return undefined;
    }

    const words = normalizedLine.split(/\s+/).filter(Boolean);
    const maxCandidateLength = Math.min(6, words.length);

    for (let length = maxCandidateLength; length >= 2; length--) {
      const candidateWords = words.slice(0, length);
      const hasConnector = candidateWords.some(word =>
        LOWERCASE_NAME_CONNECTORS.has(word.toLowerCase())
      );

      if (
        (length > 3 && !hasConnector) ||
        (words.length > length && length > 2 && !hasConnector)
      ) {
        continue;
      }

      const candidate = candidateWords.join(' ');

      if (looksLikePersonNameText(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  private static extractLocation(text: string): string | undefined {
    const lines = splitLines(text);
    const firstSectionIndex = lines.findIndex(line =>
      isSectionHeaderText(line)
    );
    const searchableLines = lines.slice(
      0,
      firstSectionIndex === -1 ? Math.min(30, lines.length) : firstSectionIndex
    );

    return searchableLines
      .map(line => normalizeWhitespace(line))
      .find(line => this.isLocationSearchLine(line));
  }

  private static extractHeadline(text: string): string | undefined {
    const lines = splitLines(text);

    for (let i = 0; i < Math.min(25, lines.length); i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      const isLikelyEmail =
        /^[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i.test(line);
      const isShortCompanyHeadline =
        !isLikelyEmail &&
        /^[A-Za-z][A-Za-z\s./+-]{1,40}\s+@\s+[A-Za-z0-9][A-Za-z0-9\s.&-]{1,40}$/.test(
          line
        );

      if (
        line.includes('http') ||
        line.includes('www.') ||
        (line.includes('@') && !isShortCompanyHeadline) ||
        lowerLine.includes('contact') ||
        lowerLine.includes('page') ||
        lowerLine.includes('skills') ||
        lowerLine.includes('languages') ||
        (!isShortCompanyHeadline && line.length < 15)
      ) {
        continue;
      }

      if (isShortCompanyHeadline) {
        return normalizeWhitespace(line);
      }

      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          return normalizeWhitespace(line);
        }
      }

      const titlePatterns = [
        /^(Senior|Lead|Principal|Chief|Director|VP|President|Software|Full[Ss]tack|Python|TypeScript).*(Engineer|Manager|Developer|Specialist)/i,
        /(Engineering|Software|Product|Data|Marketing|Sales|Business).+(Manager|Engineer|Analyst|Director)/i,
      ];

      for (const pattern of titlePatterns) {
        if (pattern.test(line) && line.length > 30) {
          return normalizeWhitespace(line);
        }
      }
    }

    const specificPattern =
      /Engineering\s+Manager\s+@\s+[A-Za-z]+\s*\|\s*[^|\n]*(?:\n[^|\n]*)?/i;
    const specificMatch = text.match(specificPattern);
    if (specificMatch) {
      return normalizeWhitespace(specificMatch[0].trim());
    }

    return undefined;
  }

  private static extractSummary(text: string): string | undefined {
    const summarySection = extractSection(text, REGEX_PATTERNS.SUMMARY);

    if (summarySection) {
      const summary = normalizeWhitespace(summarySection)
        .split('\n')
        .filter(
          line => line.trim().length > 10 && !isPageFooterLine(line.trim())
        )
        .join(' ');

      return summary || undefined;
    }

    const lines = splitLines(text);
    const potentialSummaryLines: string[] = [];

    for (let i = 5; i < Math.min(30, lines.length); i++) {
      const line = lines[i];

      if (
        line.length > 50 &&
        line.length < 200 &&
        !line.includes('@') &&
        !line.toLowerCase().includes('experience') &&
        !line.toLowerCase().includes('education') &&
        !line.toLowerCase().includes('skills')
      ) {
        potentialSummaryLines.push(line);

        if (potentialSummaryLines.join(' ').length > 100) {
          break;
        }
      }
    }

    const summary = potentialSummaryLines.join(' ');

    return summary || undefined;
  }

  private static extractStructuralSummary(
    structuralLines: StructuralLine[]
  ): string | undefined {
    const mainLines = structuralLines.filter(
      line => line.column === 'right' || line.column === 'single'
    );
    const summaryStartIndex = mainLines.findIndex(line => {
      const header = getParserLineSectionHeader(line.text);

      return header?.kind === 'target' && header.section === 'summary';
    });

    if (summaryStartIndex === -1) {
      return undefined;
    }

    const summaryLines = mainLines.slice(summaryStartIndex + 1);
    const nextSectionIndex = summaryLines.findIndex(line => {
      const header = getParserLineSectionHeader(line.text);

      return header !== undefined && header.section !== 'summary';
    });
    const sectionLines =
      nextSectionIndex === -1
        ? summaryLines
        : summaryLines.slice(0, nextSectionIndex);

    if (sectionLines.length === 0) {
      return undefined;
    }

    const summaryParts: string[] = [];

    for (const line of sectionLines.map(line => line.text)) {
      const trimmedLine = line.trim();

      // Skip short leading fragments as noise, but keep short continuation
      // lines once summary capture has started.
      if (
        !trimmedLine ||
        isPageFooterLine(trimmedLine) ||
        (trimmedLine.length <= 10 && summaryParts.length === 0)
      ) {
        continue;
      }

      summaryParts.push(trimmedLine);
    }

    const summary = normalizeWhitespace(summaryParts.join(' '));

    return summary || undefined;
  }

  private static extractContact(text: string): Contact {
    const parserLines = createTextParserLines(text);
    const textContactLines = this.extractTextContactLines(parserLines);
    const searchableLines =
      textContactLines.length > 0
        ? textContactLines
        : this.extractHeaderContactLines(parserLines);

    return this.extractContactFromLines(searchableLines);
  }

  private static extractStructuralContact(
    text: string,
    structuralLines: StructuralLine[]
  ): Contact {
    const contactSection = extractStructuralSectionLines({
      section: 'contact',
      structuralLines,
    });
    const sectionLines = contactSection.lines.map(line => line.text);

    if (!contactSection.hasSection || sectionLines.length === 0) {
      return this.extractContact(text);
    }

    return this.extractContactFromLines(sectionLines);
  }

  private static extractContactFromLines(lines: string[]): Contact {
    const contact: Contact = {};
    const contactSearchLines = this.createContactSearchLines(lines);
    const contactText = contactSearchLines.emailSearchLines.join('\n');
    const email = this.extractEmail(contactText);
    const links = this.extractContactLinks(contactSearchLines.linkSearchLines);
    const linkedInUrl = links.find(link =>
      /linkedin\.com\/in\//i.test(link.url)
    )?.url;
    const phone = this.extractPhoneFromLines(lines);

    if (email) {
      contact.email = email;
    }

    if (linkedInUrl) {
      contact.linkedin_url = linkedInUrl;
    }

    if (links.length > 0) {
      contact.links = links;
    }

    if (phone) {
      contact.phone = phone;
    }

    return contact;
  }

  private static createContactSearchLines(lines: string[]): ContactSearchLines {
    const emailSearchLines: string[] = [];
    const linkSearchLines: string[] = [];
    const normalizedLines = lines.map(line => normalizeWhitespace(line));

    for (let index = 0; index < normalizedLines.length; index += 1) {
      const line = normalizedLines[index];
      const nextLine = normalizedLines[index + 1];

      // Walk normalizedLines once: when isWrappedEmailStartLine and
      // isEmailTldContinuationLine match, emailSearchLines gets
      // "user@example." + "com" stitched while linkSearchLines skips those
      // fragments and index advances past the consumed continuation.
      if (
        nextLine !== undefined &&
        this.isWrappedEmailStartLine(line) &&
        this.isEmailTldContinuationLine(nextLine)
      ) {
        emailSearchLines.push(`${line}${nextLine}`);
        index += 1;
        continue;
      }

      emailSearchLines.push(line);
      linkSearchLines.push(line);
    }

    return { emailSearchLines, linkSearchLines };
  }

  private static extractTextContactLines(
    parserLines: NormalizedParserLine[]
  ): string[] {
    return parserLines
      .filter(line => line.section === 'contact')
      .map(line => line.text)
      .filter(line => line.length > 0);
  }

  private static extractHeaderContactLines(
    parserLines: NormalizedParserLine[]
  ): string[] {
    const headerEndIndex = Math.min(parserLines.length, 50);
    const headerLines = parserLines
      .slice(0, headerEndIndex)
      .filter(line => line.section === 'identity')
      .map(line => line.text)
      .filter(line => line.length > 0);
    const contactLines: string[] = [];

    for (let index = 0; index < headerLines.length; index += 1) {
      const line = headerLines[index];

      if (
        !this.isHeaderContactSearchLine(line) &&
        !this.isWrappedEmailStartLine(line)
      ) {
        continue;
      }

      contactLines.push(line);

      const nextLine = headerLines[index + 1];
      if (
        nextLine !== undefined &&
        this.isWrappedEmailStartLine(line) &&
        this.isEmailTldContinuationLine(nextLine)
      ) {
        contactLines.push(nextLine);
        index += 1;
      }
    }

    return contactLines;
  }

  private static extractContactLinks(lines: string[]): ContactLink[] {
    const links: ContactLink[] = [];
    let draft: ContactLinkDraft | undefined;

    for (const rawLine of lines) {
      const line = normalizeWhitespace(rawLine);

      if (!line || this.isContactNonLinkLine(line)) {
        continue;
      }

      const label = this.extractContactLinkLabel(line);
      const lineWithoutLabel = this.removeContactLinkLabel(line);
      const startsLink = this.looksLikeContactLinkStart(lineWithoutLabel);
      const continuesLink =
        draft !== undefined &&
        !startsLink &&
        this.looksLikeContactLinkContinuation(lineWithoutLabel);

      if (!draft && !startsLink) {
        continue;
      }

      if (!draft) {
        // Start a draft for a link that may be split across adjacent PDF lines.
        draft = {
          label,
          parts: lineWithoutLabel ? [lineWithoutLabel] : [],
          rawLines: [line],
        };
      } else if (!startsLink && (continuesLink || label)) {
        // Non-link-start lines may continue a draft; a trailing label closes it.
        if (lineWithoutLabel) {
          draft.parts.push(lineWithoutLabel);
        }
        draft.rawLines.push(line);
        draft.label = draft.label ?? label;
      } else {
        // A fresh link-looking line closes the previous draft before starting.
        this.pushContactLink(links, draft);
        draft = startsLink
          ? {
              label,
              parts: lineWithoutLabel ? [lineWithoutLabel] : [],
              rawLines: [line],
            }
          : undefined;
      }

      if (draft && label) {
        this.pushContactLink(links, draft);
        draft = undefined;
      }
    }

    if (draft) {
      this.pushContactLink(links, draft);
    }

    return dedupeContactLinks(links);
  }

  private static pushContactLink(
    links: ContactLink[],
    draft: ContactLinkDraft
  ): void {
    const rawUrl = joinContactLinkParts(draft.parts);
    const url = normalizeContactUrl(rawUrl);

    if (!url) {
      return;
    }

    links.push({
      ...(draft.label ? { label: draft.label } : {}),
      rawText: draft.rawLines.join(' '),
      url,
    });
  }

  private static extractPhoneFromLines(lines: string[]): string | undefined {
    for (const line of lines) {
      const normalizedLine = normalizeWhitespace(line);

      if (!this.isPhoneSearchLine(normalizedLine)) {
        continue;
      }

      const phoneMatch = this.extractPhoneCandidate(normalizedLine);

      if (phoneMatch && phoneMatch.replace(/\D/g, '').length >= 8) {
        return phoneMatch;
      }
    }

    return undefined;
  }

  private static extractPhoneCandidate(line: string): string | undefined {
    const searchableLine = normalizeWhitespace(
      line.replace(PHONE_LINE_LABEL_PATTERN, '')
    );
    const candidates = searchableLine.match(
      /(?:\+\d{1,3}\s*)?(?:\(?\d{1,4}\)?[\s.-]*){2,6}\d{2,4}/gu
    );

    for (const candidate of candidates ?? []) {
      const normalizedCandidate = normalizeWhitespace(candidate);
      const digitCount = normalizedCandidate.replace(/\D/g, '').length;

      if (digitCount >= 8 && digitCount <= 15) {
        return normalizedCandidate;
      }
    }

    const fallback = searchableLine.match(REGEX_PATTERNS.PHONE)?.[0];

    return fallback && fallback.replace(/\D/g, '').length >= 8
      ? fallback
      : undefined;
  }

  private static isContactNonLinkLine(line: string): boolean {
    return (
      /^[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,63}$/i.test(line) ||
      this.isPhoneSearchLine(line)
    );
  }

  private static extractContactLinkLabel(line: string): string | undefined {
    const match = line.match(CONTACT_LINK_LABEL_PATTERN);

    if (!match) {
      return undefined;
    }

    return match[1];
  }

  private static removeContactLinkLabel(line: string): string {
    return normalizeWhitespace(line.replace(CONTACT_LINK_LABEL_PATTERN, ''));
  }

  private static looksLikeContactLinkStart(line: string): boolean {
    return (
      /(?:^|[\s/])(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+(?:[/:/?#]|$)/i.test(
        line
      ) || /linkedin\.com\/in\//i.test(line)
    );
  }

  private static looksLikeContactLinkContinuation(line: string): boolean {
    return (
      line.length > 0 &&
      line.length <= 120 &&
      !isSectionHeaderText(line) &&
      !/^[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,63}$/i.test(line) &&
      !this.isPhoneSearchLine(line) &&
      /^[A-Za-z0-9@_~./?:#=&%+-]+$/u.test(line)
    );
  }

  private static isPhoneSearchLine(line: string): boolean {
    const normalizedLine = line.trim();

    return (
      normalizedLine.length <= 40 &&
      !normalizedLine.includes('/') &&
      !/(?:^|\s)www\./i.test(normalizedLine) &&
      !/https?:\/\//i.test(normalizedLine) &&
      !/[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(normalizedLine) &&
      !/^\(?\s*(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present)\s*\)?$/i.test(
        normalizedLine
      ) &&
      (/\b(?:mobile|phone|tel|work)\b/i.test(normalizedLine) ||
        /^[+\d\s().-]+$/.test(normalizedLine))
    );
  }

  private static isHeaderContactSearchLine(line: string): boolean {
    return (
      this.isEmailSearchLine(line) ||
      this.isPhoneSearchLine(line) ||
      this.looksLikeContactLinkStart(line)
    );
  }

  private static isEmailSearchLine(line: string): boolean {
    const normalizedLine = line.trim().replace(/\s*@\s*/g, '@');

    return (
      normalizedLine.length <= 120 &&
      (EMAIL_SEARCH_LINE_PATTERN.test(normalizedLine) ||
        LABELED_EMAIL_SEARCH_LINE_PATTERN.test(normalizedLine))
    );
  }

  private static isWrappedEmailStartLine(line: string): boolean {
    const normalizedLine = line.trim().replace(/\s*@\s*/g, '@');

    return (
      normalizedLine.length <= 120 &&
      WRAPPED_EMAIL_START_PATTERN.test(normalizedLine)
    );
  }

  private static isEmailTldContinuationLine(line: string): boolean {
    return EMAIL_TLD_CONTINUATION_PATTERN.test(line.trim());
  }

  private static extractEmail(text: string): string | undefined {
    const normalizedText = text.replace(/\s*@\s*/g, '@');
    const match = normalizedText.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}/i
    );

    return match?.[0];
  }

  private static isNameSearchLine(line: string): boolean {
    return (
      line.length >= 5 &&
      line.length <= 120 &&
      !/[0-9]/.test(line) &&
      !/[|()]/.test(line) &&
      !/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,63}/i.test(line) &&
      !/https?:\/\//i.test(line) &&
      !/(?:^|\s)www\./i.test(line) &&
      !/^page\s+\d+/i.test(line) &&
      !isSectionHeaderText(line) &&
      !isLikelyLocationText(line) &&
      !looksLikePositionTitleText(line) &&
      !looksLikeOrganizationNameText(line)
    );
  }

  private static isLocationSearchLine(line: string): boolean {
    return (
      line.length >= 3 &&
      line.length <= 120 &&
      !/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,63}/i.test(line) &&
      !/https?:\/\//i.test(line) &&
      !/(?:^|\s)www\./i.test(line) &&
      !/^page\s+\d+/i.test(line) &&
      !isSectionHeaderText(line) &&
      isLikelyLocationText(line)
    );
  }

  private static createBasicInfoWarnings(
    text: string,
    basicInfo: BasicInfo
  ): SectionParseWarning[] {
    const parserLines = createTextParserLines(text);
    const warnings: SectionParseWarning[] = [];
    const headerLines = parserLines.slice(
      0,
      findBasicInfoHeaderEndIndex(parserLines)
    );

    const hasContactSection = headerLines.some(line => {
      const header = getParserLineSectionHeader(line.text);

      return header?.kind === 'target' && header.section === 'contact';
    });
    const hasSummarySection = headerLines.some(line => {
      const header = getParserLineSectionHeader(line.text);

      return header?.kind === 'target' && header.section === 'summary';
    });

    if (
      hasContactSection &&
      !basicInfo.contact.email &&
      !basicInfo.contact.phone &&
      !basicInfo.contact.linkedin_url
    ) {
      warnings.push({
        code: 'section_parse_warning',
        field: 'contact',
        message:
          'Detected a contact section but could not extract contact fields',
        section: 'contact',
      });
    }

    if (hasSummarySection && !basicInfo.summary) {
      warnings.push({
        code: 'section_parse_warning',
        field: 'summary',
        message:
          'Detected a summary section but could not extract summary text',
        section: 'summary',
      });
    }

    return warnings;
  }
}

function findBasicInfoHeaderEndIndex(
  parserLines: NormalizedParserLine[]
): number {
  let state: BasicInfoState = 'seeking_name';

  for (let index = 0; index < parserLines.length; index++) {
    const line = parserLines[index];

    const header = getParserLineSectionHeader(line.text);

    if (header?.kind === 'target') {
      return isBasicInfoWarningSection(header.section)
        ? findBasicInfoWarningHeaderEndIndex(parserLines, index)
        : index;
    }

    state = nextBasicInfoState(state, line.text);

    if (state === 'in_summary') {
      return index + 1;
    }
  }

  return parserLines.length;
}

function joinContactLinkParts(parts: string[]): string {
  return parts.reduce((combined, part) => {
    const normalizedPart = part.trim();

    if (!combined) {
      return normalizedPart;
    }

    if (
      combined.endsWith('-') ||
      combined.endsWith('/') ||
      normalizedPart.startsWith('/') ||
      normalizedPart.startsWith('?') ||
      normalizedPart.startsWith('#')
    ) {
      return `${combined}${normalizedPart}`;
    }

    return `${combined}/${normalizedPart}`;
  }, '');
}

function normalizeContactUrl(rawUrl: string): string | undefined {
  const compactUrl = rawUrl.replace(/\s+/g, '').replace(/^\.+|\.+$/g, '');

  if (!compactUrl || !/[A-Za-z0-9]\.[A-Za-z]{2,}/.test(compactUrl)) {
    return undefined;
  }

  const linkedInMatch = compactUrl.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9-]+)/
  );

  if (linkedInMatch) {
    return `https://linkedin.com/in/${linkedInMatch[1]}`;
  }

  return /^https?:\/\//i.test(compactUrl)
    ? compactUrl
    : `https://${compactUrl}`;
}

function dedupeContactLinks(links: ContactLink[]): ContactLink[] {
  const seenUrls = new Set<string>();
  const dedupedLinks: ContactLink[] = [];

  for (const link of links) {
    if (seenUrls.has(link.url)) {
      continue;
    }

    seenUrls.add(link.url);
    dedupedLinks.push(link);
  }

  return dedupedLinks;
}

function isPageFooterLine(line: string): boolean {
  return /^page\s+\d+\s+of\s+\d+$/i.test(line.trim());
}

function findBasicInfoWarningHeaderEndIndex(
  parserLines: NormalizedParserLine[],
  startIndex: number
): number {
  let endIndex = startIndex;

  while (endIndex < parserLines.length) {
    const line = parserLines[endIndex];

    const header = getParserLineSectionHeader(line.text);

    // A non-warning target header starts the next parser section.
    if (
      header?.kind === 'target' &&
      !isBasicInfoWarningSection(header.section)
    ) {
      return endIndex;
    }

    // A hard boundary header always closes the warning header block.
    if (header?.kind === 'boundary') {
      return endIndex;
    }

    endIndex++;
  }

  return endIndex;
}

function isBasicInfoWarningSection(
  section: NormalizedParserLine['section'] | undefined
): boolean {
  return section === 'contact' || section === 'summary';
}

function nextBasicInfoState(
  state: BasicInfoState,
  line: string
): BasicInfoState {
  if (state === 'seeking_name' && line.length >= 2) {
    return 'seeking_headline';
  }

  if (state === 'seeking_headline' && line.length >= 15) {
    return 'seeking_location';
  }

  if (state === 'seeking_location' && isLikelyLocationText(line)) {
    return 'in_summary';
  }

  return state;
}
