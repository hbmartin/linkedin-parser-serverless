import { PROFILE_SECTION_HEADER_ENTRIES } from './utils/profile-section-headers.js';
import type {
  LinkedInProfile,
  ParseDiagnostics,
  ParseWarning,
  WarningSection,
} from './types/profile.js';

interface CreateParseDiagnosticsParams {
  profile: LinkedInProfile;
  text: string;
  warnings: ParseWarning[];
}

const SECTION_HEADER_BY_TEXT = new Map<string, WarningSection>(
  PROFILE_SECTION_HEADER_ENTRIES.map(([text, section]) => [
    normalizeSectionHeaderText(text),
    section,
  ])
);

export function createParseDiagnostics({
  profile,
  text,
  warnings,
}: CreateParseDiagnosticsParams): ParseDiagnostics {
  const sectionsFound = dedupeSections([
    ...detectSectionsFromText(text),
    ...detectSectionsFromWarnings(warnings),
  ]);
  const isEmpty = isEmptyProfile(profile);
  const confidence = calculateConfidence({
    isEmpty,
    profile,
    sectionsFound,
    text,
    warnings,
  });

  return {
    confidence,
    isEmpty,
    isLikelyLinkedInExport:
      !isEmpty &&
      (hasLinkedInSignal({ profile, text }) ||
        sectionsFound.length >= 2 ||
        (sectionsFound.length > 0 && confidence >= 0.5)),
    sectionsFound,
  };
}

function detectSectionsFromText(text: string): WarningSection[] {
  return text
    .split(/\r?\n/)
    .map(line => sectionFromLine(line))
    .filter((section): section is WarningSection => section !== undefined);
}

function detectSectionsFromWarnings(
  warnings: ParseWarning[]
): WarningSection[] {
  return warnings.flatMap(warning =>
    warning.code === 'section_parse_warning' ? [warning.section] : []
  );
}

function sectionFromLine(line: string): WarningSection | undefined {
  if (/[.!?]\s*$/u.test(line.trim())) {
    return undefined;
  }

  const normalizedLine = normalizeSectionHeaderText(line);
  const ampersandAsAndLine = normalizedLine.replace(/\s*&\s*/g, ' and ');

  return (
    SECTION_HEADER_BY_TEXT.get(normalizedLine) ??
    SECTION_HEADER_BY_TEXT.get(ampersandAsAndLine)
  );
}

function dedupeSections(sections: WarningSection[]): WarningSection[] {
  return Array.from(new Set(sections));
}

function calculateConfidence({
  isEmpty,
  profile,
  sectionsFound,
  text,
  warnings,
}: {
  isEmpty: boolean;
  profile: LinkedInProfile;
  sectionsFound: WarningSection[];
  text: string;
  warnings: ParseWarning[];
}): number {
  if (isEmpty) {
    return 0;
  }

  const baseScore =
    linkedInSignalScore({ profile, text }) +
    sectionScore(sectionsFound) +
    identityScore(profile) +
    contactScore(profile) +
    structuredContentScore(profile);
  const warningPenalty = Math.min(warnings.length * 0.02, 0.15);

  return roundConfidence(clampConfidence(baseScore - warningPenalty));
}

function linkedInSignalScore({
  profile,
  text,
}: {
  profile: LinkedInProfile;
  text: string;
}): number {
  return hasLinkedInSignal({ profile, text }) ? 0.3 : 0;
}

function sectionScore(sectionsFound: WarningSection[]): number {
  return Math.min(sectionsFound.length * 0.06, 0.25);
}

function identityScore(profile: LinkedInProfile): number {
  return (
    (cleanValue(profile.name) ? 0.12 : 0) +
    (cleanValue(profile.headline) ? 0.05 : 0) +
    (cleanValue(profile.location) ? 0.05 : 0)
  );
}

function contactScore(profile: LinkedInProfile): number {
  return hasContact(profile) ? 0.1 : 0;
}

function structuredContentScore(profile: LinkedInProfile): number {
  return (
    (profile.experience.length > 0 || profile.experience_groups.length > 0
      ? 0.15
      : 0) +
    (profile.education.length > 0 ? 0.1 : 0) +
    (hasListContent(profile) ? 0.1 : 0)
  );
}

function hasLinkedInSignal({
  profile,
  text,
}: {
  profile: LinkedInProfile;
  text: string;
}): boolean {
  return (
    cleanValue(profile.contact.linkedin_url) !== undefined ||
    /\blinkedin(?:\.com| profile|\b)/i.test(text)
  );
}

function isEmptyProfile(profile: LinkedInProfile): boolean {
  return (
    !cleanValue(profile.name) &&
    !cleanValue(profile.headline) &&
    !cleanValue(profile.location) &&
    !cleanValue(profile.summary) &&
    !hasContact(profile) &&
    profile.top_skills.length === 0 &&
    profile.languages.length === 0 &&
    profile.certifications.length === 0 &&
    profile.volunteer_work.length === 0 &&
    profile.projects.length === 0 &&
    profile.publications.length === 0 &&
    profile.patents.length === 0 &&
    profile.organizations.length === 0 &&
    profile.honors_awards.length === 0 &&
    profile.experience_groups.length === 0 &&
    profile.experience.length === 0 &&
    profile.education.length === 0
  );
}

function hasContact(profile: LinkedInProfile): boolean {
  return (
    cleanValue(profile.contact.email) !== undefined ||
    cleanValue(profile.contact.phone) !== undefined ||
    cleanValue(profile.contact.linkedin_url) !== undefined ||
    cleanValue(profile.contact.location) !== undefined ||
    (profile.contact.links?.length ?? 0) > 0
  );
}

function hasListContent(profile: LinkedInProfile): boolean {
  return (
    profile.top_skills.length > 0 ||
    profile.languages.length > 0 ||
    profile.certifications.length > 0 ||
    profile.volunteer_work.length > 0 ||
    profile.projects.length > 0 ||
    profile.publications.length > 0 ||
    profile.patents.length > 0 ||
    profile.organizations.length > 0 ||
    profile.honors_awards.length > 0
  );
}

function normalizeSectionHeaderText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}&]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cleanValue(value: string | undefined): string | undefined {
  const cleanedValue = value?.replace(/\s+/g, ' ').trim();

  return cleanedValue && cleanedValue.length > 0 ? cleanedValue : undefined;
}

function clampConfidence(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}
