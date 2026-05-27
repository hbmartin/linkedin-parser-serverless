import type { StructuralLine } from '../utils/structural-lines.js';
import type {
  ParsedSectionResult,
  SectionParseWarning,
} from '../types/profile.js';
import { TOP_SKILLS_LIMIT } from '../utils/parser-limits.js';
import {
  isLikelyLocationText,
  isSectionHeaderText,
} from '../utils/profile-text.js';
import { mergeWrappedStructuralListLines } from '../utils/sidebar-list-lines.js';
import { normalizeWhitespace } from '../utils/text-utils.js';

export interface StructuralIdentity {
  name?: string;
  headline?: string;
  location?: string;
  linkedinUrl?: string;
  topSkills: string[];
}

export class IdentityStructuralParser {
  static parse(lines: StructuralLine[]): StructuralIdentity {
    return this.parseWithWarnings(lines).value;
  }

  static parseWithWarnings(
    lines: StructuralLine[]
  ): ParsedSectionResult<StructuralIdentity> {
    const leftLines = lines.filter(line => line.column === 'left');
    const mainLines = lines.filter(
      line => line.column === 'right' || line.column === 'single'
    );
    const identityLines = this.extractIdentityLines(mainLines);
    const nameLine = this.findNameLine(identityLines);
    const nameIndex = nameLine ? identityLines.indexOf(nameLine) : -1;
    const locationLine = this.findLocationLine(identityLines, nameIndex);
    const locationIndex = locationLine
      ? identityLines.indexOf(locationLine)
      : -1;

    const value: StructuralIdentity = {
      name: nameLine?.text,
      headline: this.extractHeadline({
        identityLines,
        locationIndex,
        nameIndex,
      }),
      location: locationLine?.text,
      linkedinUrl: this.extractLinkedInUrl(leftLines.map(line => line.text)),
      topSkills: this.extractTopSkills(leftLines),
    };

    return {
      value,
      warnings: this.createStructuralIdentityWarnings(leftLines, value),
    };
  }

  private static extractIdentityLines(
    mainLines: StructuralLine[]
  ): StructuralLine[] {
    const visibleLines = mainLines.filter(line => !this.isNoiseLine(line.text));
    const firstSectionIndex = visibleLines.findIndex(line =>
      isSectionHeaderText(line.text)
    );

    return firstSectionIndex === -1
      ? visibleLines
      : visibleLines.slice(0, firstSectionIndex);
  }

  private static findNameLine(
    identityLines: StructuralLine[]
  ): StructuralLine | undefined {
    const candidates = identityLines.filter(line =>
      this.isIdentityCandidateLine(line.text)
    );

    if (candidates.length === 0) {
      return undefined;
    }

    return candidates.reduce((bestLine, currentLine) =>
      currentLine.fontSize > bestLine.fontSize ? currentLine : bestLine
    );
  }

  private static findLocationLine(
    identityLines: StructuralLine[],
    nameIndex: number
  ): StructuralLine | undefined {
    const searchLines =
      nameIndex === -1 ? identityLines : identityLines.slice(nameIndex + 1);

    return searchLines.find(line => isLikelyLocationText(line.text));
  }

  private static extractHeadline({
    identityLines,
    locationIndex,
    nameIndex,
  }: {
    identityLines: StructuralLine[];
    locationIndex: number;
    nameIndex: number;
  }): string | undefined {
    const startIndex = nameIndex === -1 ? 0 : nameIndex + 1;
    const endIndex =
      locationIndex === -1 || locationIndex < startIndex
        ? identityLines.length
        : locationIndex;
    const headline = normalizeWhitespace(
      identityLines
        .slice(startIndex, endIndex)
        .map(line => line.text)
        .filter(text => this.isIdentityCandidateLine(text))
        .join(' ')
    );

    return headline || undefined;
  }

  private static extractTopSkills(lines: StructuralLine[]): string[] {
    const topSkillsIndex = lines.findIndex(line =>
      /^top skills$/i.test(line.text)
    );

    if (topSkillsIndex === -1) {
      return [];
    }

    const followingLines = lines.slice(topSkillsIndex + 1);
    const endIndex = followingLines.findIndex(line =>
      isSidebarSectionHeader(line.text)
    );
    const skillLines =
      endIndex === -1 ? followingLines : followingLines.slice(0, endIndex);

    return mergeWrappedStructuralListLines(skillLines)
      .filter(skill => skill.length > 1 && skill.length < 50)
      .slice(0, TOP_SKILLS_LIMIT);
  }

  private static extractLinkedInUrl(lines: string[]): string | undefined {
    const linkedInIndex = lines.findIndex(line =>
      /linkedin\.com\/in\//i.test(line)
    );

    if (linkedInIndex === -1) {
      return undefined;
    }

    const linkedInLine = lines[linkedInIndex];
    const nextLine = lines[linkedInIndex + 1] ?? '';
    const combinedLine =
      linkedInLine.trim().endsWith('-') || /\(LinkedIn\)/i.test(nextLine)
        ? `${linkedInLine}${nextLine}`
        : linkedInLine;
    const compactLine = combinedLine
      .replace(/\s+/g, '')
      .replace(/\(LinkedIn\)/i, '');
    const match = compactLine.match(
      /(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9-]+)/
    );

    return match ? `https://linkedin.com/in/${match[1]}` : undefined;
  }

  private static isIdentityCandidateLine(text: string): boolean {
    return (
      !this.isNoiseLine(text) &&
      !isSectionHeaderText(text) &&
      text.length >= 2 &&
      text.length <= 180
    );
  }

  private static isNoiseLine(text: string): boolean {
    return (
      !text ||
      /[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,63}/i.test(text) ||
      /https?:\/\//i.test(text) ||
      /(?:^|\s)www\./i.test(text) ||
      /^page\s+\d+\s+of\s+\d+$/i.test(text)
    );
  }

  private static createStructuralIdentityWarnings(
    leftLines: StructuralLine[],
    identity: StructuralIdentity
  ): SectionParseWarning[] {
    const warnings: SectionParseWarning[] = [];
    const hasTopSkillsSection = leftLines.some(line =>
      /^top skills$/i.test(line.text)
    );
    const hasContactSection = leftLines.some(line =>
      /^contact$/i.test(line.text)
    );
    const hasLinkedInText = leftLines.some(line =>
      /linkedin\.com\/in\//i.test(line.text)
    );

    if (hasTopSkillsSection && identity.topSkills.length === 0) {
      warnings.push({
        code: 'section_parse_warning',
        field: 'section',
        message: 'Detected a top skills section but could not extract skills',
        section: 'top_skills',
      });
    }

    if (hasContactSection && hasLinkedInText && !identity.linkedinUrl) {
      warnings.push({
        code: 'section_parse_warning',
        field: 'linkedin_url',
        message: 'Detected a LinkedIn URL but could not normalize it',
        section: 'contact',
      });
    }

    return warnings;
  }
}

function isSidebarSectionHeader(text: string): boolean {
  return isSectionHeaderText(text);
}
