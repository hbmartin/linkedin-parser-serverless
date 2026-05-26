type LocationStructuralContext = 'profile' | 'metadata' | 'after-duration';

type LocationSignal =
  | 'remote'
  | 'postal-code'
  | 'exact-place'
  | 'known-place'
  | 'country-or-region'
  | 'admin-region'
  | 'region-code'
  | 'comma-region'
  | 'qualified-area'
  | 'proper-shape'
  | 'after-duration'
  | 'too-long'
  | 'bad-character'
  | 'duration'
  | 'sentence-verb'
  | 'prose-shape'
  | 'relational-connector'
  | 'title-or-organization';

interface LocationClassifierContext {
  structuralContext?: LocationStructuralContext;
}

interface ClassifyLocationTextParams {
  text: string;
  context?: LocationClassifierContext;
}

interface LocationClassification {
  isLocation: boolean;
  score: number;
  signals: readonly LocationSignal[];
}

const locationThreshold = 4;
const afterDurationLocationThreshold = 4;

const connectorWords: ReadonlySet<string> = new Set([
  'and',
  'de',
  'del',
  'la',
  'of',
  'the',
]);

const remoteLocationTexts: ReadonlySet<string> = new Set([
  'hybrid',
  'on site',
  'on-site',
  'onsite',
  'remote',
]);

const knownPlaceNames: ReadonlySet<string> = new Set([
  'atlanta',
  'austin',
  'berlin',
  'baltimore',
  'boston',
  'charlottesville',
  'chicago',
  'dallas',
  'denver',
  'dubai',
  'geneva',
  'greenwich',
  'harjumaa',
  'the hague',
  'houston',
  'incheon',
  'kauai',
  'london',
  'los angeles',
  'miami',
  'minneapolis st paul',
  'minneapolis',
  'munich',
  'münchen',
  'new york',
  'new york city',
  'palo alto',
  'paris',
  'rio de janeiro',
  'reno',
  'san diego',
  'san francisco',
  'sao paulo',
  'seattle',
  'seoul',
  'singapore',
  'smithfield',
  'st louis',
  'stamford',
  'sydney',
  'tallinn',
  'tel aviv',
  'tokyo',
  'toronto',
  'washington',
]);

const countryAndRegionNames: ReadonlySet<string> = new Set([
  'australia',
  'brasil',
  'brazil',
  'canada',
  'china',
  'england',
  'estonia',
  'france',
  'germany',
  'deutschland',
  'india',
  'ireland',
  'israel',
  'italy',
  'japan',
  'korea',
  'mexico',
  'portugal',
  'scotland',
  'singapore',
  'spain',
  'netherlands',
  'switzerland',
  'united kingdom',
  'united states',
  'united arab emirates',
  'vereinigte arabische emirate',
  'vatican city state holy see',
  'wales',
]);

const adminRegionNames: ReadonlySet<string> = new Set([
  'bayern',
  'california',
  'connecticut',
  'colorado',
  'florida',
  'georgia',
  'harjumaa',
  'hawaii',
  'illinois',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'nevada',
  'new york',
  'ohio',
  'ontario',
  'pennsylvania',
  'quebec',
  'rhode island',
  'texas',
  'virginia',
]);

const regionCodes: ReadonlySet<string> = new Set([
  'ak',
  'al',
  'ar',
  'az',
  'ca',
  'can',
  'co',
  'dc',
  'de',
  'fl',
  'ga',
  'hi',
  'ia',
  'id',
  'il',
  'in',
  'ks',
  'ky',
  'la',
  'ma',
  'md',
  'me',
  'mi',
  'mn',
  'mo',
  'ms',
  'mt',
  'nc',
  'nd',
  'ne',
  'nh',
  'nj',
  'nm',
  'nv',
  'ny',
  'oh',
  'ok',
  'on',
  'or',
  'pa',
  'qc',
  'ri',
  'sc',
  'sd',
  'tn',
  'tx',
  'uk',
  'us',
  'usa',
  'ut',
  'va',
  'vt',
  'wa',
  'wi',
  'wv',
  'wy',
]);

const genericLocationQualifiers: ReadonlySet<string> = new Set([
  'area',
  'bay',
  'county',
  'metropolitan',
  'metro',
  'province',
  'region',
  'state',
]);

const titleOrOrganizationWords: ReadonlySet<string> = new Set([
  'assistant',
  'associate',
  'chief',
  'college',
  'company',
  'consulate',
  'consultant',
  'corporate',
  'corporation',
  'director',
  'engineer',
  'federation',
  'finance',
  'fellow',
  'foundation',
  'founder',
  'forex',
  'group',
  'head',
  'intern',
  'investor',
  'law',
  'manager',
  'officer',
  'partner',
  'partners',
  'president',
  'principal',
  'professor',
  'researcher',
  'school',
  'scientist',
  'service',
  'services',
  'university',
]);

const ambiguousRegionCodes: ReadonlySet<string> = new Set(['in', 'me', 'or']);

const sentenceStartVerbs: ReadonlySet<string> = new Set([
  'built',
  'created',
  'developed',
  'drove',
  'enabled',
  'founded',
  'grew',
  'helped',
  'implemented',
  'improved',
  'led',
  'managed',
  'owned',
  'provided',
  'served',
  'supported',
  'worked',
]);

export function classifyLocationText({
  context,
  text,
}: ClassifyLocationTextParams): LocationClassification {
  const normalizedText = normalizeVisibleText(text);
  const signals: LocationSignal[] = [];
  let score = 0;

  function add(signal: LocationSignal, value: number): void {
    if (!signals.includes(signal)) {
      signals.push(signal);
    }

    score += value;
  }

  if (normalizedText.length === 0) {
    return { isLocation: false, score: 0, signals };
  }

  if (normalizedText.length > 120) {
    add('too-long', -5);
    return { isLocation: false, score, signals };
  }

  if (/[$@!?;:]/u.test(normalizedText)) {
    add('bad-character', -5);
    return { isLocation: false, score, signals };
  }

  if (looksLikeDurationText(normalizedText)) {
    add('duration', -5);
    return { isLocation: false, score, signals };
  }

  const lookupText = normalizeLookupText(normalizedText);
  const words = visibleWords(normalizedText);
  const lookupWords = lookupWordsFor(lookupText);

  if (startsWithSentenceVerb(lookupWords)) {
    add('sentence-verb', -4);
  }

  if (words.length > 8 || endsWithSentencePunctuation(words)) {
    add('prose-shape', -3);
  }

  const hasBlockedDomainWord = lookupWords.some(word =>
    titleOrOrganizationWords.has(word)
  );
  if (hasBlockedDomainWord) {
    add('title-or-organization', -4);
  }

  const hasRelationalConnector = lookupWords.some(
    word => word === 'in' || word === 'à'
  );

  if (remoteLocationTexts.has(lookupText)) {
    add('remote', 5);
  }

  if (/^\d{5}(?:-\d{3,4})?$/u.test(normalizedText)) {
    add('postal-code', 5);
  }

  const exactPlace = knownPlaceNames.has(lookupText);
  const hasKnownPlace =
    exactPlace || containsKnownPhrase(lookupText, knownPlaceNames);
  const hasCountryOrRegion =
    countryAndRegionNames.has(lookupText) ||
    containsKnownPhrase(lookupText, countryAndRegionNames);
  const hasAdminRegion =
    adminRegionNames.has(lookupText) ||
    containsKnownPhrase(lookupText, adminRegionNames);
  const hasRegionCode = hasContextualRegionCode({
    hasKnownPlace,
    lookupWords,
    normalizedText,
  });
  const hasCommaRegion = hasCommaSeparatedRegionEvidence(normalizedText);
  const hasQualifiedArea =
    hasGenericLocationQualifier(lookupWords) &&
    (hasKnownPlace || hasCountryOrRegion || hasAdminRegion || hasRegionCode);
  const hasProperShape = looksLikeProperLocationShape(words);

  if (hasRelationalConnector && hasKnownPlace && hasCountryOrRegion) {
    add('relational-connector', -6);
  }

  if (exactPlace) {
    add('exact-place', context?.structuralContext === 'metadata' ? 2 : 4);
  } else if (hasKnownPlace) {
    add('known-place', 3);
  }

  if (hasCountryOrRegion) {
    add('country-or-region', countryAndRegionNames.has(lookupText) ? 4 : 3);
  }

  if (hasAdminRegion) {
    add('admin-region', adminRegionNames.has(lookupText) ? 4 : 2);
  }

  if (hasRegionCode) {
    add('region-code', 2);
  }

  if (hasCommaRegion) {
    add('comma-region', 2);
  }

  if (hasQualifiedArea) {
    add('qualified-area', 2);
  }

  if (hasProperShape) {
    add('proper-shape', 1);
  }

  if (context?.structuralContext === 'after-duration') {
    add('after-duration', 1);
  }

  const threshold =
    context?.structuralContext === 'after-duration'
      ? afterDurationLocationThreshold
      : locationThreshold;

  return {
    isLocation: score >= threshold && !hardReject(signals),
    score,
    signals,
  };
}

export function isLikelyScoredLocationText(text: string): boolean {
  return classifyLocationText({ text }).isLocation;
}

function normalizeVisibleText(text: string): string {
  return text
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/,+$/u, '')
    .trim();
}

function normalizeLookupText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/-/g, ' ')
    .replace(/[().,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function visibleWords(text: string): string[] {
  return text
    .split(/\s+/u)
    .map(word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, ''))
    .filter(word => word.length > 0);
}

function lookupWordsFor(lookupText: string): string[] {
  return lookupText.split(/\s+/u).filter(word => word.length > 0);
}

function endsWithSentencePunctuation(words: readonly string[]): boolean {
  const lastWord = words[words.length - 1];

  return (
    lastWord !== undefined &&
    /[.!?]$/u.test(lastWord) &&
    !/^(?:[\p{Lu}]\.)+$/u.test(lastWord)
  );
}

function hardReject(signals: readonly LocationSignal[]): boolean {
  return (
    signals.includes('too-long') ||
    signals.includes('bad-character') ||
    signals.includes('duration') ||
    signals.includes('sentence-verb')
  );
}

function looksLikeDurationText(text: string): boolean {
  return (
    /\b\d{4}\s*[\p{Pd}−]\s*(?:\d{4}|present|current)\b/iu.test(text) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/iu.test(
      text
    ) ||
    /\(\d+\s+(?:years?|months?|anos?|meses?)[^)]*\)/iu.test(text)
  );
}

function startsWithSentenceVerb(words: readonly string[]): boolean {
  const firstWord = words[0];

  return firstWord !== undefined && sentenceStartVerbs.has(firstWord);
}

function containsKnownPhrase(
  text: string,
  phrases: ReadonlySet<string>
): boolean {
  for (const phrase of phrases) {
    if (phrase.length > 0 && containsDelimitedPhrase(text, phrase)) {
      return true;
    }
  }

  return false;
}

function containsDelimitedPhrase(text: string, phrase: string): boolean {
  let searchIndex = 0;

  while (searchIndex <= text.length) {
    const index = text.indexOf(phrase, searchIndex);

    if (index < 0) {
      return false;
    }

    const before = text[index - 1];
    const after = text[index + phrase.length];

    if (isDelimiter(before) && isDelimiter(after)) {
      return true;
    }

    searchIndex = index + phrase.length;
  }

  return false;
}

function isDelimiter(value: string | undefined): boolean {
  return value === undefined || !/[\p{L}\p{N}]/u.test(value);
}

function hasContextualRegionCode({
  hasKnownPlace,
  lookupWords,
  normalizedText,
}: {
  hasKnownPlace: boolean;
  lookupWords: readonly string[];
  normalizedText: string;
}): boolean {
  const codeWords = regionCodeCandidates(lookupWords).filter(word =>
    regionCodes.has(word)
  );

  if (codeWords.length === 0) {
    return false;
  }

  const hasUnambiguousRegionCode = codeWords.some(
    word => !ambiguousRegionCodes.has(word)
  );

  if (hasKnownPlace && hasUnambiguousRegionCode) {
    return true;
  }

  const commaSegments = normalizedText
    .split(',')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);

  if (commaSegments.length < 2) {
    return false;
  }

  return commaSegments.some(segment => {
    const lookupSegment = normalizeLookupText(segment);
    const segmentWords = lookupWordsFor(lookupSegment);
    const hasKnownPlaceSegment =
      hasKnownPlace && containsKnownPhrase(lookupSegment, knownPlaceNames);
    const hasUnambiguousRegionCodeSegment = regionCodeCandidates(
      segmentWords
    ).some(word => codeWords.includes(word) && !ambiguousRegionCodes.has(word));

    return hasKnownPlaceSegment || hasUnambiguousRegionCodeSegment;
  });
}

function regionCodeCandidates(words: readonly string[]): string[] {
  const candidates: string[] = [];

  for (const word of words) {
    candidates.push(word);
  }

  for (let index = 0; index < words.length - 1; index += 1) {
    const firstWord = words[index];
    const secondWord = words[index + 1];

    if (
      firstWord !== undefined &&
      secondWord !== undefined &&
      firstWord.length === 1 &&
      secondWord.length === 1
    ) {
      candidates.push(`${firstWord}${secondWord}`);
    }
  }

  return candidates;
}

function hasCommaSeparatedRegionEvidence(text: string): boolean {
  const parts = text
    .split(',')
    .map(part => normalizeLookupText(part))
    .filter(part => part.length > 0);

  if (parts.length < 2 || parts.length > 3) {
    return false;
  }

  return parts
    .slice(1)
    .some(
      part =>
        regionCodes.has(part) ||
        countryAndRegionNames.has(part) ||
        adminRegionNames.has(part)
    );
}

function hasGenericLocationQualifier(words: readonly string[]): boolean {
  return words.some(word => genericLocationQualifiers.has(word));
}

function looksLikeProperLocationShape(words: readonly string[]): boolean {
  return (
    words.length > 0 &&
    words.length <= 7 &&
    words.every(word => {
      const lookupWord = normalizeLookupText(word);

      return (
        connectorWords.has(lookupWord) ||
        regionCodes.has(lookupWord) ||
        /^[\p{Lu}\d][\p{L}\p{M}\d.'-]*$/u.test(word)
      );
    })
  );
}
