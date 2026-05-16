const EXPERIENCE_SECTION_HEADER_TEXT = new Set([
  'experience',
  'experiencia',
  'experiência',
]);

const EDUCATION_SECTION_HEADER_TEXT = new Set([
  'education',
  'formacao',
  'formação',
]);

const SECTION_HEADER_TEXT = new Set([
  'contact',
  'contact info',
  'top skills',
  'skills',
  'languages',
  'summary',
  ...EXPERIENCE_SECTION_HEADER_TEXT,
  ...EDUCATION_SECTION_HEADER_TEXT,
  'idiomas',
  'competencias',
  'competências',
  'habilidades',
  'certifications',
  'licenses & certifications',
  'licenses and certifications',
  'certificacoes',
  'certificações',
  'projects',
  'projetos',
  'volunteer experience',
  'volunteer work',
  'volunteering',
  'experiencia voluntaria',
  'experiência voluntária',
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
  'corporation',
  'enterprises',
  'foundation',
  'fund',
  'group',
  'inc',
  'industries',
  'institute',
  'labs',
  'llc',
  'ltd',
  'network',
  'organisation',
  'organization',
  'partners',
  'research',
  'school',
  'services',
  'software',
  'solutions',
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
  'chief',
  'consultant',
  'consultor',
  'co-founder',
  'coordenador',
  'coordinator',
  'developer',
  'desenvolvedor',
  'director',
  'diretor',
  'engineer',
  'engenheiro',
  'fellow',
  'founder',
  'gerente',
  'gestor',
  'head of',
  'intern',
  'lead',
  'manager',
  'officer',
  'president',
  'principal',
  'producer',
  'researcher',
  'specialist',
  'supervisor',
  'technical lead',
  'tech lead',
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
  'the',
  'van',
  'von',
  'y',
]);

const SINGLE_WORD_LOCATION_TEXT = new Set([
  'remote',
  'hybrid',
  'onsite',
  'on-site',
  'california',
  'texas',
  'florida',
  'illinois',
  'pennsylvania',
  'ohio',
  'georgia',
  'michigan',
  'brasil',
  'brazil',
  'portugal',
  'united states',
]);

const wholeKeywordPatternCache = new Map<string, RegExp>();

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
  const normalizedText = normalizeProfileText(text);
  const lowerText = normalizedText.toLowerCase();
  const hasPositionKeyword = POSITION_KEYWORDS.some(keyword =>
    includesWholeKeyword(lowerText, keyword)
  );

  const looksLikeDescription =
    normalizedText.length > 90 ||
    lowerText.startsWith('i ') ||
    lowerText.startsWith('as ') ||
    lowerText.startsWith('worked as ') ||
    lowerText.includes('i lead') ||
    lowerText.includes('i manage') ||
    lowerText.includes('i work') ||
    lowerText.includes('i was') ||
    lowerText.includes('responsible for') ||
    lowerText.includes('working as') ||
    lowerText.includes('joined the') ||
    lowerText.includes('my role') ||
    lowerText.includes(' to ') ||
    /^[a-z]/.test(normalizedText) ||
    normalizedText.includes('•') ||
    normalizedText.includes('...') ||
    normalizedText.split(/\s+/).length > 15;

  const hasAllowedParenthetical =
    !/[()]/u.test(normalizedText) ||
    /^[^()]+ \((?:contractor|contract|consultant|internship|intern|freelance|part[-\s]?time|full[-\s]?time)\)$/iu.test(
      normalizedText
    );
  const hasValidTitleFormat =
    normalizedText.length > 3 &&
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
  const normalizedText = normalizeProfileText(text);

  if (
    normalizedText.length < 2 ||
    normalizedText.length > 80 ||
    normalizedText.includes('@') ||
    /https?:\/\//i.test(normalizedText) ||
    /\blinkedin\.com\b/i.test(normalizedText) ||
    normalizedText.includes('•') ||
    /^page\s+\d+\s+of\s+\d+$/i.test(normalizedText) ||
    looksLikeDateOrDurationText(normalizedText) ||
    looksLikePositionTitleText(normalizedText) ||
    isSectionHeaderText(normalizedText)
  ) {
    return false;
  }

  const words = organizationWords(normalizedText);
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
    .replace(/\s+-\s+.*$/, '')
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
  return text
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const normalizedText = normalizeProfileText(text);
  const lowerText = normalizedText.toLowerCase();

  return (
    SINGLE_WORD_LOCATION_TEXT.has(lowerText) ||
    /^greater\s+[\p{Lu}][\p{L}\p{M}.'\-\s]+(?:area)?$/iu.test(normalizedText) ||
    /^[\p{Lu}][\p{L}\p{M}\s]+(?:Bay|Metropolitan)\s+Area$/u.test(
      normalizedText
    ) ||
    /^[\p{Lu}][\p{L}\s]+,\s*[\p{Lu}]{2}$/u.test(normalizedText) ||
    looksLikeCommaSeparatedLocationText(normalizedText)
  );
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

function includesWholeKeyword(text: string, keyword: string): boolean {
  let pattern = wholeKeywordPatternCache.get(keyword);

  if (!pattern) {
    const keywordPattern = keyword
      .split(/\s+/)
      .map(part => escapeRegExp(part))
      .join('\\s+');

    pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${keywordPattern}($|[^\\p{L}\\p{N}])`,
      'iu'
    );
    wholeKeywordPatternCache.set(keyword, pattern);
  }

  return pattern.test(text);
}

function looksLikeCommaSeparatedLocationText(text: string): boolean {
  const parts = text.split(',').map(part => part.trim());
  const hasOrganizationSuffix = parts
    .slice(1)
    .some(part =>
      ORGANIZATION_WORDS.has(part.toLowerCase().replace(/[.]/g, ''))
    );

  return (
    !hasOrganizationSuffix &&
    parts.length >= 2 &&
    parts.length <= 3 &&
    parts.every(
      (part, index) =>
        (index > 0 && /^[\p{Lu}]{2}$/u.test(part)) ||
        looksLikeLocationNamePart(part)
    )
  );
}

function looksLikeLocationNamePart(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  const hasLocationWord = words.some(
    word =>
      !LOWERCASE_CONNECTOR_WORDS.has(word.toLowerCase()) &&
      /^[\p{Lu}][\p{L}\p{M}'-]+$/u.test(word) &&
      /[\p{Ll}]/u.test(word)
  );

  return (
    hasLocationWord &&
    words.length > 0 &&
    words.every(
      word =>
        LOWERCASE_CONNECTOR_WORDS.has(word.toLowerCase()) ||
        (/^[\p{Lu}][\p{L}\p{M}'-]+$/u.test(word) && /[\p{Ll}]/u.test(word))
    )
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
