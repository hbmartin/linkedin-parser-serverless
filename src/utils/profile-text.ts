import { isLikelyScoredLocationText } from './location-classifier.js';
import { PROFILE_SECTION_HEADER_ENTRIES } from './profile-section-headers.js';
import { BoundedStringCache } from './bounded-cache.js';

const PROFILE_TEXT_CACHE_LIMIT = 2048;
const normalizedProfileTextCache = new BoundedStringCache<string>(
  PROFILE_TEXT_CACHE_LIMIT
);
const positionTitleTextCache = new BoundedStringCache<boolean>(
  PROFILE_TEXT_CACHE_LIMIT
);
const organizationNameTextCache = new BoundedStringCache<boolean>(
  PROFILE_TEXT_CACHE_LIMIT
);

const EXPERIENCE_SECTION_HEADER_TEXT = new Set([
  'berufserfahrung',
  'erfaring',
  'experience',
  'experiencia',
  'experiência',
  'esperienza',
  'expérience',
]);

const EDUCATION_SECTION_HEADER_TEXT = new Set([
  'education',
  'formacao',
  'formação',
  'formazione',
  'formation',
  'utdanning',
]);

const SECTION_HEADER_TEXT = new Set([
  ...PROFILE_SECTION_HEADER_ENTRIES.map(([text]) => text),
  'licenses & certifications',
  'courses',
  'honors-awards',
  'honours-awards',
  'recommendations',
  'interests',
]);

const ORGANIZATION_WORDS = new Set([
  'agency',
  'association',
  'bank',
  'capital',
  'center',
  'centre',
  'co',
  'college',
  'company',
  'consulting',
  'corp',
  'corps',
  'corporation',
  'defense',
  'enterprises',
  'federation',
  'forces',
  'forex',
  'foundation',
  'fund',
  'gmbh',
  'group',
  'inc',
  'industries',
  'institute',
  'international',
  'labs',
  'llc',
  'llp',
  'lp',
  'ltd',
  'management',
  'network',
  'organisation',
  'organization',
  'partners',
  'research',
  'school',
  'services',
  'software',
  'solutions',
  'society',
  'studio',
  'systems',
  'tech',
  'technologies',
  'technology',
  'university',
  'ventures',
  'wireless',
]);

const POSITION_KEYWORDS = [
  'advisor',
  'analyst',
  'architect',
  'assessor',
  'assistant',
  'associate',
  'ceo',
  'chief',
  'consultant',
  'consultor',
  'commissioner',
  'commander',
  'co-founder',
  'co founder',
  'cofounder',
  'coo',
  'columnist',
  'coordenador',
  'coordinator',
  'corporate finance',
  'developer',
  'desenvolvedor',
  'designer',
  'director',
  'diretor',
  'engineer',
  'engenheiro',
  'executive',
  'executive advisor',
  'fellow',
  'fixed income investments',
  'founder',
  'founding team',
  'gerente',
  'gestor',
  'head of',
  'intern',
  'investor',
  'investment team',
  'leader',
  'lead',
  'marine',
  'manager',
  'member',
  'member of the board',
  'mentor',
  'officer',
  'partner',
  'president',
  'principal',
  'professor',
  'producer',
  'programmer',
  'project leader',
  'quantitative research',
  'research analyst',
  'research assistant',
  'research associate',
  'research fellow',
  'researcher',
  'research scientist',
  'scientist',
  'svp',
  'specialist',
  'supervisor',
  'technical lead',
  'tech lead',
  'undergraduate research',
  'vice president',
  'vp',
  'writer',
];

const LOWERCASE_CONNECTOR_WORDS = new Set([
  'al',
  'and',
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
  'for',
  'la',
  'le',
  'of',
  'than',
  'the',
  'van',
  'von',
  'y',
]);

const PERSON_LIKE_ORGANIZATION_TEXT = new Set(['goldman sachs']);

const POSITION_KEYWORD_PATTERN = createWholeKeywordPattern(POSITION_KEYWORDS);

export function isSectionHeaderText(text: string): boolean {
  return SECTION_HEADER_TEXT.has(normalizeProfileText(text).toLowerCase());
}

export function isExperienceSectionHeaderText(text: string): boolean {
  return EXPERIENCE_SECTION_HEADER_TEXT.has(
    normalizeProfileText(text).toLowerCase()
  );
}

export function isEducationSectionHeaderText(text: string): boolean {
  return EDUCATION_SECTION_HEADER_TEXT.has(
    normalizeProfileText(text).toLowerCase()
  );
}

export function looksLikePositionTitleText(text: string): boolean {
  return positionTitleTextCache.getOrSet(text, () =>
    looksLikePositionTitleTextUncached(text)
  );
}

function looksLikePositionTitleTextUncached(text: string): boolean {
  const normalizedText = normalizeProfileText(text);
  const lowerText = normalizedText.toLowerCase();
  const hasPositionKeyword = POSITION_KEYWORD_PATTERN.test(lowerText);

  const looksLikeDescription =
    normalizedText.length > 90 ||
    lowerText.startsWith('i ') ||
    lowerText.startsWith('as ') ||
    lowerText.startsWith('worked as ') ||
    lowerText.includes('i lead') ||
    lowerText.includes('i manage') ||
    lowerText.includes('i work') ||
    lowerText.includes('i was') ||
    lowerText.includes(' by ') ||
    lowerText.includes('responsible for') ||
    lowerText.includes('working as') ||
    lowerText.includes('joined the') ||
    lowerText.includes('my role') ||
    (lowerText.includes(' to ') && !hasPositionKeyword) ||
    /^[a-z]/.test(normalizedText) ||
    normalizedText.includes('•') ||
    hasEllipsisText(normalizedText) ||
    normalizedText.split(/\s+/).length > 15;

  const hasAllowedParenthetical =
    !/[()]/u.test(normalizedText) ||
    (hasPositionKeyword &&
      hasDomainParenthetical(normalizedText) &&
      /^[^()]+ \([\p{L}\p{M}\p{N}\s&/+.-]{2,80}\)$/u.test(normalizedText)) ||
    /^[^()]+ \((?:acquired|contractor|contract|consultant|internship|intern|freelance|part[-\s]?time|full[-\s]?time)\)$/iu.test(
      normalizedText
    ) ||
    /^[^()]+ \(fixed[-\s]?term(?:\s+consulting)?\)$/iu.test(normalizedText) ||
    /^[^()]+ \([\p{Lu}\s]{2,30}\)$/u.test(normalizedText);
  const hasValidTitleFormat =
    normalizedText.length >= 2 &&
    normalizedText.length < 90 &&
    hasAllowedParenthetical &&
    !normalizedText.includes('•') &&
    !normalizedText.includes('http') &&
    !normalizedText.includes('@') &&
    !looksLikeDateOrDurationText(normalizedText) &&
    !isSectionHeaderText(normalizedText);

  return hasPositionKeyword && !looksLikeDescription && hasValidTitleFormat;
}

export function looksLikeExperienceDetailText(text: string): boolean {
  const normalizedText = normalizeProfileText(text);

  return (
    looksLikeDateOrDurationText(normalizedText) ||
    looksLikePositionTitleText(normalizedText) ||
    /^page\s+\d+/i.test(normalizedText)
  );
}

export function looksLikeOrganizationNameText(text: string): boolean {
  return organizationNameTextCache.getOrSet(text, () =>
    looksLikeOrganizationNameTextUncached(text)
  );
}

function looksLikeOrganizationNameTextUncached(text: string): boolean {
  const normalizedText = normalizeProfileText(text);

  if (
    normalizedText.length < 2 ||
    normalizedText.length > 80 ||
    normalizedText.includes('@') ||
    /https?:\/\//i.test(normalizedText) ||
    /\blinkedin\.com\b/i.test(normalizedText) ||
    normalizedText.includes('•') ||
    hasEllipsisText(normalizedText) ||
    /^page\s+\d+\s+of\s+\d+$/i.test(normalizedText) ||
    looksLikeDateOrDurationText(normalizedText) ||
    looksLikePositionTitleText(normalizedText) ||
    isSectionHeaderText(normalizedText)
  ) {
    return false;
  }

  const words = organizationWords(normalizedText);
  const isKnownPersonLikeOrganization = PERSON_LIKE_ORGANIZATION_TEXT.has(
    normalizedText.toLowerCase()
  );
  const hasOrganizationWord = words.some(word =>
    ORGANIZATION_WORDS.has(word.toLowerCase().replace(/[.]/g, ''))
  );
  const hasConnector = /[,/&]/.test(normalizedText);
  const isAcronym = /^[A-Z][A-Z0-9&.+/-]{1,15}$/.test(normalizedText);
  const isSingleBrandWord =
    isSingleBrandWordShape(normalizedText) &&
    !isLikelyLocationText(normalizedText);
  const isProperOrganizationPhrase =
    words.length >= 2 &&
    words.length <= 8 &&
    words.every(word => isOrganizationWordShape(word)) &&
    !isLikelyLocationText(normalizedText) &&
    (hasOrganizationWord || hasConnector || hasDistinctiveBrandWord(words));

  return (
    isKnownPersonLikeOrganization ||
    isAcronym ||
    isSingleBrandWord ||
    (isProperOrganizationPhrase && !looksLikePersonNameText(normalizedText))
  );
}

export function cleanOrganizationNameText(text: string): string | undefined {
  const normalizedText = normalizeProfileText(text)
    .replace(/^[•*-]\s*/, '')
    .replace(
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\s*[-–]\s*(?:[a-z]+\s+\d{4}|present|current)/gi,
      ''
    )
    .replace(/\b\d{4}\s*[-–]\s*(?:\d{4}|present|current)\b/gi, '')
    .replace(/\(\d+\s+(?:years?|months?|anos?|meses?)[^)]*\)/gi, '')
    .replace(/\s+[|•]\s+.*$/, '')
    .replace(/[,:;]+$/, '')
    .trim();

  if (!normalizedText || !looksLikeOrganizationNameText(normalizedText)) {
    return undefined;
  }

  return normalizedText;
}

export function looksLikePersonNameText(text: string): boolean {
  const normalizedText = normalizeProfileText(text);

  if (
    normalizedText.includes(',') ||
    normalizedText.includes('.') ||
    normalizedText.includes('/') ||
    normalizedText.includes('&') ||
    normalizedText.includes('@')
  ) {
    return false;
  }

  const words = normalizedText.split(/\s+/).filter(Boolean);
  const hasOrganizationWord = words.some(word =>
    ORGANIZATION_WORDS.has(word.toLowerCase())
  );
  const meaningfulWords = words.filter(
    word => !LOWERCASE_CONNECTOR_WORDS.has(word.toLowerCase())
  );
  const hasShortAcronymWord = meaningfulWords.some(word =>
    /^[A-Z]{2,3}$/.test(word)
  );

  return (
    !hasOrganizationWord &&
    !hasShortAcronymWord &&
    words.length >= 2 &&
    words.length <= 6 &&
    meaningfulWords.length >= 2 &&
    words.every(word => looksLikePersonNameWord(word))
  );
}

function normalizeProfileText(text: string): string {
  return normalizedProfileTextCache.getOrSet(text, () =>
    text
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function hasEllipsisText(text: string): boolean {
  return text.includes('...') || text.includes('…');
}

function hasDomainParenthetical(text: string): boolean {
  const match = text.match(/\(([^()]*)\)$/u);
  const parentheticalText = match?.[1]?.toLowerCase();

  return parentheticalText
    ? /\d/.test(parentheticalText) ||
        /\b(?:acquired|company|deep tech|digital tech|tech)\b/u.test(
          parentheticalText
        )
    : false;
}

function looksLikeDateOrDurationText(text: string): boolean {
  return (
    /\b\d{4}\s*[-–]\s*(?:\d{4}|present|current)\b/i.test(text) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/i.test(
      text
    ) ||
    /\(\d+\s+(?:years?|months?|anos?|meses?)[^)]*\)/i.test(text) ||
    /\d+\s+(?:years?|months?|anos?|meses?)\s+\d+\s+(?:years?|months?|anos?|meses?)/i.test(
      text
    )
  );
}

function organizationWords(text: string): string[] {
  return text
    .replace(/[()]/g, ' ')
    .split(/[\s/]+/)
    .map(word => word.replace(/^[,]+|[,]+$/g, ''))
    .filter(Boolean);
}

function isOrganizationWordShape(word: string): boolean {
  return (
    LOWERCASE_CONNECTOR_WORDS.has(word.toLowerCase()) ||
    word === '&' ||
    /^[\p{Lu}0-9][\p{L}0-9&.'+-]*$/u.test(word)
  );
}

function isSingleBrandWordShape(word: string): boolean {
  return (
    /^[\p{Lu}0-9][\p{L}0-9&.+-]{1,35}$/u.test(word) &&
    !/^[\p{Lu}][\p{Ll}]{1,2}$/u.test(word)
  );
}

function hasDistinctiveBrandWord(words: string[]): boolean {
  return words.some(word => {
    if (LOWERCASE_CONNECTOR_WORDS.has(word.toLowerCase())) {
      return false;
    }

    return isSingleBrandWordShape(word);
  });
}

export function isLikelyLocationText(text: string): boolean {
  return isLikelyScoredLocationText(normalizeProfileText(text));
}

export function hasSentenceTerminalPunctuation(text: string): boolean {
  return /[.!?]\s*$/u.test(normalizeProfileText(text));
}

function looksLikePersonNameWord(word: string): boolean {
  if (LOWERCASE_CONNECTOR_WORDS.has(word.toLowerCase())) {
    return true;
  }

  if (!/^[\p{L}\p{M}]+(?:[.'-][\p{L}\p{M}]+)*\.?$/u.test(word)) {
    return false;
  }

  return /[\p{Lu}]/u.test(word) || word === word.toLocaleUpperCase();
}

function createWholeKeywordPattern(keywords: readonly string[]): RegExp {
  const keywordAlternatives = keywords
    .toSorted((left, right) => right.length - left.length)
    .map(keyword =>
      keyword
        .split(/\s+/)
        .map(part => escapeRegExp(part))
        .join('\\s+')
    )
    .join('|');

  return new RegExp(
    `(^|[^\\p{L}\\p{N}])(?:${keywordAlternatives})($|[^\\p{L}\\p{N}])`,
    'iu'
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
