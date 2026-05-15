const SECTION_HEADER_TEXT = new Set([
  'contact',
  'contact info',
  'top skills',
  'skills',
  'languages',
  'summary',
  'experience',
  'experiencia',
  'experiência',
  'education',
  'formacao',
  'formação',
  'idiomas',
  'competencias',
  'competências',
  'habilidades',
  'certifications',
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
  'group',
  'inc',
  'industries',
  'institute',
  'labs',
  'llc',
  'ltd',
  'network',
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
  'researcher',
  'specialist',
  'supervisor',
  'technical lead',
  'tech lead',
  'vice president',
  'vp',
];

const LOWERCASE_CONNECTOR_WORDS = new Set([
  'and',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'of',
  'the',
]);

export function isSectionHeaderText(text: string): boolean {
  return SECTION_HEADER_TEXT.has(normalizeProfileText(text).toLowerCase());
}

export function looksLikePositionTitleText(text: string): boolean {
  const normalizedText = normalizeProfileText(text);
  const lowerText = normalizedText.toLowerCase();
  const hasPositionKeyword = POSITION_KEYWORDS.some(keyword =>
    lowerText.includes(keyword)
  );

  const looksLikeDescription =
    normalizedText.length > 90 ||
    lowerText.startsWith('i ') ||
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

  const hasValidTitleFormat =
    normalizedText.length > 3 &&
    normalizedText.length < 90 &&
    !normalizedText.includes('(') &&
    !normalizedText.includes(')') &&
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
    /^[A-Z][A-Za-z0-9&.+-]{1,35}$/.test(normalizedText) &&
    !/^[A-Z][a-z]{1,2}$/.test(normalizedText);
  const isProperOrganizationPhrase =
    words.length >= 2 &&
    words.length <= 8 &&
    words.every(word => isOrganizationWordShape(word)) &&
    (hasOrganizationWord || hasConnector);

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

  return (
    !hasOrganizationWord &&
    words.length >= 2 &&
    words.length <= 3 &&
    words.every(word => /^[A-Z][a-z]+(?:[-'][A-Z][a-z]+)?$/.test(word))
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
    /^[A-Z0-9][A-Za-z0-9&.'+-]*$/.test(word)
  );
}
