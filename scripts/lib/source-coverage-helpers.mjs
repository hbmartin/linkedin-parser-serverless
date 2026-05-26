export const sourceCoverageSections = [
  'identity',
  'contact',
  'summary',
  'experience',
  'education',
  'top_skills',
  'languages',
  'certifications',
  'volunteer_work',
  'projects',
  'publications',
  'honors_awards',
  'recommendations',
  'interests',
  'causes',
  'activity',
  'unknown',
];

const defaultMainColumnStart = 24;
const ignoredSegmentPatterns = [
  /^page\s+\d+\s+of\s+\d+$/,
  /^linkedin$/,
  /^open profile$/,
];
const headingSections = [
  ['contact', /^contact$/],
  ['top_skills', /^top skills$/],
  ['languages', /^languages$/],
  ['certifications', /^certifications$/],
  ['summary', /^summary$/],
  ['experience', /^(?:experience|berufserfahrung)$/],
  ['education', /^education$/],
  ['projects', /^projects$/],
  ['publications', /^publications$/],
  ['honors_awards', /^honors(?:[-\s]+(?:and[-\s]+)?awards)?$/],
  ['volunteer_work', /^volunteer(?:ing)?(?: experience)?$/],
  ['recommendations', /^recommendations$/],
  ['interests', /^interests$/],
  ['causes', /^causes$/],
  ['activity', /^activity$/],
  ['contact', /^kontakt$/],
];
const profileSectionByKey = new Map([
  ['contact', 'contact'],
  ['top_skills', 'top_skills'],
  ['languages', 'languages'],
  ['certifications', 'certifications'],
  ['volunteer_work', 'volunteer_work'],
  ['projects', 'projects'],
  ['publications', 'publications'],
  ['honors_awards', 'honors_awards'],
  ['summary', 'summary'],
  ['experience_groups', 'experience'],
  ['experience', 'experience'],
  ['education', 'education'],
]);
const identityProfileKeys = new Set(['headline', 'location', 'name']);
const derivedOutputPathPatterns = [
  /^warnings(?:\.|\[|$)/,
  /\.dates\.(?:start|end)\.iso$/,
  /\.dates\.(?:start|end)\.precision$/,
  /\.dates\.kind$/,
];
const languageProficiencyTokens = new Set([
  'bilingual',
  'elementary',
  'full',
  'limited',
  'native',
  'professional',
  'working',
]);
const sourceMetadataFieldRoles = new Set(['duration', 'location']);
const standaloneLocationPlaceNames = setFromList(
  'atlanta|austin|baltimore|berlin|boston|charlottesville|chicago|dallas|denver|dubai|geneva|greenwich|harjumaa|the hague|houston|incheon|kauai|london|los angeles|miami|minneapolis st paul|minneapolis|munich|münchen|new york|new york city|palo alto|paris|reno|rio de janeiro|san diego|san francisco|sao paulo|seattle|seoul|singapore|smithfield|st louis|stamford|sydney|tallinn|tel aviv|tokyo|toronto|washington'
);
const standaloneLocationCountryRegions = setFromList(
  'australia|brasil|brazil|canada|china|deutschland|england|estonia|france|germany|india|ireland|israel|italy|japan|korea|mexico|netherlands|portugal|scotland|singapore|spain|switzerland|united arab emirates|united kingdom|united states|vereinigte arabische emirate|vatican city state holy see|wales'
);
const standaloneLocationAdminRegions = setFromList(
  'bayern|california|colorado|connecticut|florida|georgia|harjumaa|hawaii|illinois|maryland|massachusetts|michigan|minnesota|nevada|new york|ohio|ontario|pennsylvania|quebec|rhode island|texas|virginia'
);
const standaloneLocationRegionCodes = setFromList(
  'ak|al|ar|az|ca|can|co|dc|de|fl|ga|hi|ia|id|il|in|ks|ky|la|ma|md|me|mi|mn|mo|ms|mt|nc|nd|ne|nh|nj|nm|nv|ny|oh|ok|on|or|pa|qc|ri|sc|sd|tn|tx|uk|us|usa|ut|va|vt|wa|wi|wv|wy'
);
const standaloneLocationGenericQualifiers = setFromList(
  'area|bay|county|metropolitan|metro|province|region|state'
);
const standaloneLocationNegativeWords = setFromList(
  'assistant|associate|chief|college|company|consulate|consultant|corporate|corporation|director|engineer|finance|fellow|foundation|founder|group|head|intern|investor|law|manager|officer|partner|partners|president|principal|professor|researcher|school|scientist|university'
);

export function normalizeText(value) {
  return value
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[•·]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/([a-z])\.([A-Z])/g, '$1. $2')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function createSourceSegmentsFromLayoutText(layoutText) {
  const pages = layoutText.split('\f');
  const rawLines = pages.flatMap(pageText => pageText.split(/\r?\n/));
  const mainColumnStart = inferMainColumnStart(rawLines);
  const sectionState = {
    main: undefined,
    sidebar: undefined,
  };
  const segments = [];
  let lineNumber = 0;

  for (const [pageOffset, pageText] of pages.entries()) {
    if (pageOffset > 0) {
      sectionState.sidebar = undefined;
    }

    const pageLines = pageText.split(/\r?\n/);

    for (const rawLine of pageLines) {
      lineNumber += 1;

      for (const layoutSegment of splitLayoutSegments(rawLine)) {
        const text = layoutSegment.text.trim();
        const normalizedText = normalizeText(text);

        if (normalizedText.length === 0 || ignoredSegment(normalizedText)) {
          continue;
        }

        const column =
          layoutSegment.startColumn >= mainColumnStart ? 'main' : 'sidebar';
        const headingSection = sectionFromHeading(normalizedText);

        if (headingSection !== undefined) {
          sectionState[column] = headingSection;

          if (pageOffset > 0 && column === 'sidebar') {
            sectionState.main = headingSection;
          }

          continue;
        }

        const section = inferSegmentSection({
          column,
          pageIndex: pageOffset,
          sectionState,
        });

        segments.push({
          column,
          lineNumber,
          pageIndex: pageOffset,
          rawLine,
          section,
          startColumn: layoutSegment.startColumn,
          text,
        });
      }
    }
  }

  return {
    mainColumnStart,
    segments: annotateSourceSegmentsWithFieldRoles(segments),
  };
}

export function createSourceCoverageReport({
  layoutText,
  parsedJson,
  pdfFileName,
}) {
  const sourceView = createSourceSegmentsFromLayoutText(layoutText);
  const outputValues = collectOutputValues(parsedJson);
  const outputValuesBySection = groupBySection(outputValues);
  const sourceSegmentsBySection = groupBySection(sourceView.segments);
  const combinedSourceTextBySection = combineSourceTextBySection(
    sourceSegmentsBySection
  );
  const unmatchedSourceSegments = [];
  const looseSourceMatches = [];
  const crossSectionOutputMatches = [];
  const fieldMismatchOutputMatches = [];
  const untracedOutputValues = [];

  for (const [index, segment] of sourceView.segments.entries()) {
    const matchingOutputValues =
      outputValuesBySection.get(segment.section) ?? [];
    const match = bestSourceTextMatch(
      sourceTextCandidatesForSegment(sourceView.segments, index),
      matchingOutputValues.map(value => value.value)
    );

    if (match.kind === 'none') {
      unmatchedSourceSegments.push(segment);
      continue;
    }

    if (match.kind === 'loose') {
      looseSourceMatches.push({
        ...segment,
        matchedValue: match.value,
      });
    }
  }

  for (const outputValue of outputValues) {
    const combinedSourceText =
      combinedSourceTextBySection.get(outputValue.section) ?? '';
    const match = bestTextMatch(outputValue.value, [combinedSourceText]);

    if (match.kind === 'none') {
      const crossSectionMatch = crossSectionOutputMatch({
        combinedSourceTextBySection,
        outputValue,
      });

      if (crossSectionMatch !== undefined) {
        crossSectionOutputMatches.push(crossSectionMatch);
        continue;
      }

      untracedOutputValues.push(outputValue);
    }
  }

  fieldMismatchOutputMatches.push(
    ...createFieldMismatchOutputMatches({
      outputValues,
      sourceSegmentsBySection,
    })
  );

  const sections = createSectionReports({
    fieldMismatchOutputMatches,
    outputValuesBySection,
    sourceSegmentsBySection,
    crossSectionOutputMatches,
    unmatchedSourceSegments,
    untracedOutputValues,
  });

  return {
    pdfFileName,
    mainColumnStart: sourceView.mainColumnStart,
    rawSegmentCount: sourceView.segments.length,
    unmatchedSourceSegmentCount: unmatchedSourceSegments.length,
    unmatchedSourceSegments,
    looseSourceMatchCount: looseSourceMatches.length,
    looseSourceMatches,
    crossSectionOutputMatchCount: crossSectionOutputMatches.length,
    crossSectionOutputMatches,
    fieldMismatchOutputMatchCount: fieldMismatchOutputMatches.length,
    fieldMismatchOutputMatches,
    outputValueCount: outputValues.length,
    untracedOutputValueCount: untracedOutputValues.length,
    untracedOutputValues,
    sections,
  };
}

export function collectOutputValues(value) {
  const entries = [];

  collectOutputValuesAtPath(value, '', entries);

  return entries;
}

function splitLayoutSegments(rawLine) {
  return Array.from(rawLine.matchAll(/\S(?:.*?\S)?(?=\s{2,}|$)/g)).map(
    match => ({
      startColumn: match.index ?? 0,
      text: match[0],
    })
  );
}

function annotateSourceSegmentsWithFieldRoles(segments) {
  const fieldRolesByIndex = new Map();

  annotateExperienceFieldRoles({ fieldRolesByIndex, segments });

  return segments.map((segment, index) => {
    const fieldMetadata = fieldRolesByIndex.get(index);

    return fieldMetadata === undefined
      ? segment
      : {
          ...segment,
          ...fieldMetadata,
        };
  });
}

function annotateExperienceFieldRoles({ fieldRolesByIndex, segments }) {
  const entries = sectionSegmentEntries({ section: 'experience', segments });
  let entryState = 'start';
  let groupIndex = -1;
  let positionIndex = -1;

  for (const [entryIndex, { index, segment }] of entries.entries()) {
    const role = experienceFieldRole({
      entries,
      entryIndex,
      entryState,
      text: segment.text,
    });

    if (role !== undefined) {
      if (role === 'organization') {
        groupIndex += 1;
        positionIndex += 1;
      } else if (
        role === 'title' &&
        (entryState === 'afterDuration' ||
          entryState === 'afterLocation' ||
          entryState === 'afterDescription')
      ) {
        positionIndex += 1;
      }

      fieldRolesByIndex.set(index, {
        experienceGroupIndex: groupIndex,
        experiencePositionIndex: positionIndex,
        fieldRole: role,
      });
      entryState = nextEntryState(role);
    }
  }
}

function sectionSegmentEntries({ section, segments }) {
  return segments
    .map((segment, index) => ({
      index,
      segment,
    }))
    .filter(entry => entry.segment.section === section);
}

function experienceFieldRole({ entries, entryIndex, entryState, text }) {
  if (isDurationText(text)) {
    return 'duration';
  }

  if (entryState === 'start' || startsExperienceEntry(entries, entryIndex)) {
    return 'organization';
  }

  if (
    (entryState === 'afterOrganization' || entryState === 'afterDescription') &&
    nextEntryTextIsDuration(entries, entryIndex)
  ) {
    return 'title';
  }

  if (
    (entryState === 'afterDuration' || entryState === 'afterLocation') &&
    nextEntryTextIsDuration(entries, entryIndex)
  ) {
    return 'title';
  }

  if (
    (entryState === 'afterDuration' || entryState === 'afterLocation') &&
    isLikelyStandaloneLocation(text) &&
    !startsExperienceEntry(entries, entryIndex)
  ) {
    return 'location';
  }

  if (
    entryState === 'afterDuration' ||
    entryState === 'afterLocation' ||
    entryState === 'afterDescription'
  ) {
    return 'description';
  }

  if (entryState === 'afterOrganization') {
    return 'title';
  }

  return undefined;
}

function nextEntryState(role) {
  switch (role) {
    case 'organization':
      return 'afterOrganization';
    case 'title':
      return 'afterTitle';
    case 'duration':
      return 'afterDuration';
    case 'location':
      return 'afterLocation';
    case 'description':
      return 'afterDescription';
    default:
      return 'start';
  }
}

function startsExperienceEntry(entries, entryIndex) {
  return (
    !isDurationText(entries[entryIndex].segment.text) &&
    entries[entryIndex + 1] !== undefined &&
    entries[entryIndex + 2] !== undefined &&
    !isDurationText(entries[entryIndex + 1].segment.text) &&
    isDurationText(entries[entryIndex + 2].segment.text)
  );
}

function nextEntryTextIsDuration(entries, entryIndex) {
  const nextEntry = entries[entryIndex + 1];

  return (
    nextEntry !== undefined &&
    (isDurationText(nextEntry.segment.text) ||
      isEducationYearText(nextEntry.segment.text))
  );
}

function isDurationText(value) {
  const normalizedValue = normalizeText(value);

  return (
    /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{4})\s*-\s*(?:present|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{4}))/u.test(
      normalizedValue
    ) ||
    /^\d+\s+(?:year|years|yr|yrs|month|months|mo|mos)\b(?:\s+\d+\s+(?:month|months|mo|mos)\b)?/u.test(
      normalizedValue
    ) ||
    /\(\d+\s+(?:year|years|yr|yrs|month|months|mo|mos)\b/u.test(normalizedValue)
  );
}

function isEducationYearText(value) {
  return /^(?:\d{4})(?:\s*-\s*(?:\d{4}|present))?$/u.test(normalizeText(value));
}

function isLikelyStandaloneLocation(value) {
  const normalizedValue = normalizeText(value);

  if (
    normalizedValue.length === 0 ||
    normalizedValue.length > 80 ||
    isDurationText(value) ||
    /[$@]/u.test(normalizedValue) ||
    /[!?;:]/u.test(normalizedValue) ||
    startsWithSentenceVerb(value)
  ) {
    return false;
  }

  if (/^(?:remote|hybrid|onsite)$/u.test(normalizedValue)) {
    return true;
  }

  return standaloneLocationScore({ normalizedValue, value }) >= 4;
}

function standaloneLocationScore({ normalizedValue, value }) {
  const lookupText = normalizeLocationLookupText(value);
  const lookupWords = lookupText.split(/\s+/u).filter(Boolean);
  const hasKnownPlace = containsKnownStandaloneLocationPhrase(
    lookupText,
    standaloneLocationPlaceNames
  );
  const hasCountryRegion = containsKnownStandaloneLocationPhrase(
    lookupText,
    standaloneLocationCountryRegions
  );
  const hasAdminRegion = containsKnownStandaloneLocationPhrase(
    lookupText,
    standaloneLocationAdminRegions
  );
  const hasRegionCode = hasContextualStandaloneRegionCode({
    hasKnownPlace,
    lookupWords,
    value,
  });
  const hasGenericQualifier = lookupWords.some(word =>
    standaloneLocationGenericQualifiers.has(word)
  );
  const hasNegativeWord = lookupWords.some(word =>
    standaloneLocationNegativeWords.has(word)
  );
  let score = 1;

  if (!looksLikeLocationWords(value)) {
    score -= 3;
  }

  if (hasNegativeWord) {
    score -= 4;
  }

  if (standaloneLocationPlaceNames.has(lookupText)) {
    score += 4;
  } else if (hasKnownPlace) {
    score += 3;
  }

  if (standaloneLocationCountryRegions.has(lookupText)) {
    score += 4;
  } else if (hasCountryRegion) {
    score += 3;
  }

  if (standaloneLocationAdminRegions.has(lookupText)) {
    score += 4;
  } else if (hasAdminRegion) {
    score += 2;
  }

  if (hasRegionCode) {
    score += 2;
  }

  if (hasCommaSeparatedStandaloneRegionEvidence(value)) {
    score += 2;
  }

  if (
    hasGenericQualifier &&
    (hasKnownPlace || hasCountryRegion || hasAdminRegion || hasRegionCode)
  ) {
    score += 2;
  }

  if (startsWithSentenceVerb(value) || normalizedValue.split(/\s+/u).length > 8) {
    score -= 4;
  }

  return score;
}

function looksLikeLocationWords(value) {
  const normalizedValue = normalizeText(value);
  const words = value
    .split(/\s+/u)
    .map(word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(word => word.length > 0);

  return (
    words.length >= 1 &&
    words.length <= 7 &&
    words.every(
      word =>
        /^[\p{Lu}\d][\p{L}\d.'-]*$/u.test(word) ||
        /^(?:of|and|de|del|la|the)$/iu.test(word)
    ) &&
    !/\b(?:llc|llp|inc|corp|corporation|company|group|partners|university|college|school|foundation|law|engineer|manager|director|partner|consultant|professor|assistant|associate|scientist|researcher|fellow|intern|president|founder|officer|chief|head|principal|investor)\b/u.test(
      normalizedValue
    )
  );
}

function setFromList(value) {
  return new Set(value.split('|'));
}

function normalizeLocationLookupText(value) {
  return normalizeText(value)
    .replace(/-/g, ' ')
    .replace(/[().,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsKnownStandaloneLocationPhrase(value, phrases) {
  for (const phrase of phrases) {
    if (containsDelimitedPhrase(value, phrase)) {
      return true;
    }
  }

  return false;
}

function containsDelimitedPhrase(value, phrase) {
  let searchIndex = 0;

  while (searchIndex <= value.length) {
    const index = value.indexOf(phrase, searchIndex);

    if (index < 0) {
      return false;
    }

    const before = value[index - 1];
    const after = value[index + phrase.length];

    if (isStandaloneLocationDelimiter(before) && isStandaloneLocationDelimiter(after)) {
      return true;
    }

    searchIndex = index + phrase.length;
  }

  return false;
}

function isStandaloneLocationDelimiter(value) {
  return value === undefined || !/[\p{L}\p{N}]/u.test(value);
}

function hasContextualStandaloneRegionCode({ hasKnownPlace, lookupWords, value }) {
  const hasRegionCode = standaloneRegionCodeCandidates(lookupWords).some(word =>
    standaloneLocationRegionCodes.has(word)
  );

  return hasRegionCode && (hasKnownPlace || value.includes(','));
}

function standaloneRegionCodeCandidates(words) {
  const candidates = [...words];

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

function hasCommaSeparatedStandaloneRegionEvidence(value) {
  const parts = value
    .split(',')
    .map(part => normalizeLocationLookupText(part))
    .filter(Boolean);

  if (parts.length < 2 || parts.length > 3) {
    return false;
  }

  return parts.slice(1).some(
    part =>
      standaloneLocationRegionCodes.has(part) ||
      standaloneLocationCountryRegions.has(part) ||
      standaloneLocationAdminRegions.has(part)
  );
}

function startsWithSentenceVerb(value) {
  return /^(?:built|created|developed|drove|enabled|founded|grew|helped|implemented|improved|led|managed|owned|provided|served|supported|worked)\b/iu.test(
    value.trim()
  );
}

function inferMainColumnStart(rawLines) {
  const startColumns = rawLines
    .flatMap(rawLine => splitLayoutSegments(rawLine))
    .filter(segment => {
      const normalizedText = normalizeText(segment.text);

      return (
        segment.startColumn > 12 &&
        normalizedText.length > 2 &&
        !ignoredSegment(normalizedText)
      );
    })
    .map(segment => segment.startColumn)
    .sort((left, right) => left - right);

  if (startColumns.length === 0) {
    return defaultMainColumnStart;
  }

  return startColumns[Math.floor(startColumns.length * 0.1)];
}

function ignoredSegment(normalizedText) {
  return ignoredSegmentPatterns.some(pattern => pattern.test(normalizedText));
}

function sectionFromHeading(normalizedText) {
  return headingSections.find(([, pattern]) =>
    pattern.test(normalizedText)
  )?.[0];
}

function inferSegmentSection({ column, pageIndex, sectionState }) {
  if (column === 'main') {
    return sectionState.main ?? 'identity';
  }

  if (
    pageIndex > 0 &&
    sectionState.main !== undefined &&
    sectionState.sidebar === 'contact'
  ) {
    return sectionState.main;
  }

  return sectionState.sidebar ?? sectionState.main ?? 'unknown';
}

function collectOutputValuesAtPath(value, path, entries) {
  if (typeof value === 'string') {
    const normalizedValue = normalizeText(value);
    const section = sectionFromPath(path);

    if (
      normalizedValue.length > 0 &&
      section !== undefined &&
      !derivedOutputPath(path) &&
      !defaultOutputValue({ normalizedValue, path })
    ) {
      entries.push({
        path,
        section,
        value,
      });
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectOutputValuesAtPath(item, `${path}[${index}]`, entries);
    });
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, childValue] of Object.entries(value)) {
      collectOutputValuesAtPath(
        childValue,
        path.length === 0 ? key : `${path}.${key}`,
        entries
      );
    }
  }
}

function derivedOutputPath(path) {
  return derivedOutputPathPatterns.some(pattern => pattern.test(path));
}

function defaultOutputValue({ normalizedValue, path }) {
  return (
    /^profile\.languages\[\d+\]\.proficiency$/.test(path) &&
    normalizedValue === 'unknown'
  );
}

function sectionFromPath(path) {
  const profilePathMatch = /^profile\.([a-z_]+)/.exec(path);

  if (profilePathMatch === null) {
    return undefined;
  }

  const profileKey = profilePathMatch[1];

  if (identityProfileKeys.has(profileKey)) {
    return 'identity';
  }

  return profileSectionByKey.get(profileKey);
}

function groupBySection(items) {
  const groups = new Map();

  for (const item of items) {
    const groupedItems = groups.get(item.section) ?? [];

    groupedItems.push(item);
    groups.set(item.section, groupedItems);
  }

  return groups;
}

function combineSourceTextBySection(sourceSegmentsBySection) {
  const combinedSourceTextBySection = new Map();

  for (const [section, sourceSegments] of sourceSegmentsBySection) {
    combinedSourceTextBySection.set(
      section,
      sourceSegments.map(segment => segment.text).join(' ')
    );
  }

  return combinedSourceTextBySection;
}

function bestSourceTextMatch(sourceTexts, candidateValues) {
  let looseMatch;

  for (const sourceText of sourceTexts) {
    const match = bestTextMatch(sourceText, candidateValues);

    if (match.kind === 'exact') {
      return match;
    }

    if (match.kind === 'loose' && looseMatch === undefined) {
      looseMatch = match;
    }
  }

  return looseMatch ?? { kind: 'none' };
}

function sourceTextCandidatesForSegment(segments, index) {
  const segment = segments[index];
  const candidates = [segment.text];
  const previousSegment = adjacentSourceSegment({
    direction: -1,
    index,
    segments,
  });
  const nextSegment = adjacentSourceSegment({
    direction: 1,
    index,
    segments,
  });
  const previousText = previousSegment?.text;
  const nextText = nextSegment?.text;

  if (previousText !== undefined) {
    candidates.push(`${previousText} ${segment.text}`);
  }

  if (nextText !== undefined) {
    candidates.push(`${segment.text} ${nextText}`);
  }

  if (previousText !== undefined && nextText !== undefined) {
    candidates.push(`${previousText} ${segment.text} ${nextText}`);
  }

  return candidates;
}

function adjacentSourceSegment({ direction, index, segments }) {
  const segment = segments[index];

  for (
    let candidateIndex = index + direction;
    candidateIndex >= 0 && candidateIndex < segments.length;
    candidateIndex += direction
  ) {
    const candidate = segments[candidateIndex];

    if (candidate.pageIndex !== segment.pageIndex) {
      return undefined;
    }

    if (Math.abs(candidate.lineNumber - segment.lineNumber) > 2) {
      return undefined;
    }

    if (candidate.column !== segment.column) {
      continue;
    }

    return candidate.section === segment.section ? candidate : undefined;
  }

  return undefined;
}

function crossSectionOutputMatch({ combinedSourceTextBySection, outputValue }) {
  for (const [section, combinedSourceText] of combinedSourceTextBySection) {
    if (section === outputValue.section) {
      continue;
    }

    const match = bestTextMatch(outputValue.value, [combinedSourceText]);

    if (match.kind !== 'none') {
      return {
        ...outputValue,
        matchKind: match.kind,
        matchedSection: section,
      };
    }
  }

  return undefined;
}

function createFieldMismatchOutputMatches({
  outputValues,
  sourceSegmentsBySection,
}) {
  const mismatches = [];
  const seenMismatches = new Set();

  for (const outputValue of outputValues) {
    const outputFieldRole = outputFieldRoleFromPath(outputValue.path);

    if (outputFieldRole === undefined) {
      continue;
    }

    const matchCandidates = [];

    for (const segment of sourceSegmentsBySection.get(outputValue.section) ??
      []) {
      if (
        segment.fieldRole === undefined ||
        segment.fieldRole === outputFieldRole ||
        !fieldMismatchIsHighConfidence({
          outputFieldRole,
          outputValue,
          segment,
        })
      ) {
        continue;
      }

      const match = bestTextMatch(segment.text, [outputValue.value]);

      if (match.kind !== 'none') {
        matchCandidates.push({ match, segment });
      }
    }

    const ordinalMatchCandidates = matchCandidates.filter(({ segment }) =>
      sourceSegmentMatchesOutputPath({
        outputPath: outputValue.path,
        segment,
      })
    );
    const selectedMatchCandidates =
      ordinalMatchCandidates.length > 0
        ? ordinalMatchCandidates
        : matchCandidates;

    for (const { match, segment } of selectedMatchCandidates) {
      const mismatchKey = [
        outputValue.path,
        outputFieldRole,
        segment.fieldRole,
        normalizeText(segment.text),
      ].join('\0');

      if (seenMismatches.has(mismatchKey)) {
        continue;
      }

      seenMismatches.add(mismatchKey);
      mismatches.push({
        path: outputValue.path,
        section: outputValue.section,
        value: outputValue.value,
        outputFieldRole,
        sourceFieldRole: segment.fieldRole,
        sourceText: segment.text,
        sourceLineNumber: segment.lineNumber,
        sourcePageIndex: segment.pageIndex,
        matchKind: match.kind,
      });
    }
  }

  return mismatches;
}

function sourceSegmentMatchesOutputPath({ outputPath, segment }) {
  const outputExperienceIndex = outputExperienceIndexFromPath(outputPath);

  if (outputExperienceIndex === undefined) {
    return true;
  }

  if (
    outputExperienceIndex.kind === 'group' &&
    segment.experienceGroupIndex !== undefined
  ) {
    return segment.experienceGroupIndex === outputExperienceIndex.index;
  }

  if (
    outputExperienceIndex.kind === 'position' &&
    segment.experiencePositionIndex !== undefined
  ) {
    return segment.experiencePositionIndex === outputExperienceIndex.index;
  }

  return true;
}

function outputExperienceIndexFromPath(path) {
  const experiencePathMatch = /^profile\.experience\[(\d+)]/.exec(path);

  if (experiencePathMatch !== null) {
    return {
      index: Number(experiencePathMatch[1]),
      kind: 'position',
    };
  }

  const groupPathMatch = /^profile\.experience_groups\[(\d+)]/.exec(path);

  if (groupPathMatch !== null) {
    return {
      index: Number(groupPathMatch[1]),
      kind: 'group',
    };
  }

  return undefined;
}

function outputFieldRoleFromPath(path) {
  if (
    !/^profile\.(?:experience|experience_groups|education)(?:\.|\[)/u.test(path)
  ) {
    return undefined;
  }

  if (/(?:^|\.)description$/u.test(path)) {
    return 'description';
  }

  if (/(?:^|\.)location$/u.test(path)) {
    return 'location';
  }

  if (
    /(?:^|\.)(?:duration|totalDuration|year)$/u.test(path) ||
    /\.dates\.(?:originalText|durationText|start\.text|end\.text)$/u.test(path)
  ) {
    return 'duration';
  }

  if (/(?:^|\.)(?:company|institution)$/u.test(path)) {
    return 'organization';
  }

  if (/(?:^|\.)(?:title|degree)$/u.test(path)) {
    return 'title';
  }

  return undefined;
}

function fieldMismatchIsHighConfidence({
  outputFieldRole,
  outputValue,
  segment,
}) {
  if (outputFieldRole !== 'description') {
    return false;
  }

  return (
    sourceMetadataFieldRoles.has(segment.fieldRole) &&
    sourceTextTouchesOutputBoundary({
      outputValue: outputValue.value,
      sourceText: segment.text,
    })
  );
}

function sourceTextTouchesOutputBoundary({ outputValue, sourceText }) {
  return textVariants(outputValue).some(outputVariant =>
    textVariants(sourceText).some(
      sourceVariant =>
        outputVariant === sourceVariant ||
        outputVariant.startsWith(`${sourceVariant} `) ||
        outputVariant.endsWith(` ${sourceVariant}`)
    )
  );
}

function bestTextMatch(sourceText, candidateValues) {
  const sourceVariants = textVariants(sourceText);
  const sourceTokens = meaningfulTokens(sourceText);
  let looseValue;

  for (const candidateValue of candidateValues) {
    const candidateVariants = textVariants(candidateValue);

    if (
      sourceVariants.some(sourceVariant =>
        candidateVariants.some(
          candidateVariant =>
            sourceVariant === candidateVariant ||
            sourceVariant.includes(candidateVariant) ||
            candidateVariant.includes(sourceVariant)
        )
      )
    ) {
      return {
        kind: 'exact',
        value: candidateValue,
      };
    }

    const candidateText = normalizeText(candidateVariants.join(' '));
    const hasEnoughTokens = sourceTokens.length >= 2 || sourceText.length >= 12;

    if (
      hasEnoughTokens &&
      sourceTokens.length > 0 &&
      sourceTokens.every(token => candidateText.includes(token))
    ) {
      looseValue = candidateValue;
    }

    if (
      sourceTokens.length === 1 &&
      languageProficiencyTokens.has(sourceTokens[0]) &&
      candidateText.includes(sourceTokens[0])
    ) {
      looseValue = candidateValue;
    }
  }

  if (looseValue !== undefined) {
    return {
      kind: 'loose',
      value: looseValue,
    };
  }

  return {
    kind: 'none',
  };
}

function textVariants(value) {
  const variants = new Set();
  const normalizedValue = normalizeText(value);
  const withoutBullet = normalizedValue.replace(/^[-*]\s+/, '');
  const withoutTrailingKind = withoutBullet.replace(
    /\s+\((?:blog|company|linkedin|mobile|home|other|work)\)$/,
    ''
  );
  const withoutLabel = withoutTrailingKind.replace(
    /^[a-z][a-z0-9 /&.'-]{1,32}:\s+/,
    ''
  );
  const withoutWrappedHyphenSpaces = withoutLabel.replace(/-\s+/g, '-');
  const withoutUrlSeparatorSpaces = withoutWrappedHyphenSpaces.replace(
    /\s*([/:~._-])\s*/g,
    '$1'
  );
  const withoutScheme = withoutWrappedHyphenSpaces.replace(/^https?:\/\//, '');
  const withoutSchemeAndUrlSpaces = withoutUrlSeparatorSpaces.replace(
    /^https?:\/\//,
    ''
  );
  const withoutWww = withoutScheme.replace(/^www\./, '');
  const withoutWwwAndUrlSpaces = withoutSchemeAndUrlSpaces.replace(
    /^www\./,
    ''
  );
  const baseVariants = [
    normalizedValue,
    withoutBullet,
    withoutTrailingKind,
    withoutLabel,
    withoutWrappedHyphenSpaces,
    withoutUrlSeparatorSpaces,
    withoutScheme,
    withoutSchemeAndUrlSpaces,
    withoutWww,
    withoutWwwAndUrlSpaces,
  ];
  const urlVariants = [
    withoutScheme.length > 0 ? `https://${withoutScheme}` : '',
    withoutSchemeAndUrlSpaces.length > 0
      ? `https://${withoutSchemeAndUrlSpaces}`
      : '',
    withoutWww.length > 0 ? `https://www.${withoutWww}` : '',
    withoutWwwAndUrlSpaces.length > 0
      ? `https://www.${withoutWwwAndUrlSpaces}`
      : '',
  ];

  for (const variant of [...baseVariants, ...urlVariants]) {
    if (variant.length > 0) {
      variants.add(variant);
    }
  }

  return [...variants];
}

function meaningfulTokens(value) {
  return normalizeText(value)
    .split(/[^a-z0-9+/#]+/)
    .filter(token => token.length >= 2)
    .filter(token => !/^\d+$/.test(token));
}

function createSectionReports({
  fieldMismatchOutputMatches,
  outputValuesBySection,
  sourceSegmentsBySection,
  crossSectionOutputMatches,
  unmatchedSourceSegments,
  untracedOutputValues,
}) {
  const sectionNames = new Set([
    ...sourceCoverageSections,
    ...sourceSegmentsBySection.keys(),
    ...outputValuesBySection.keys(),
  ]);

  return [...sectionNames].map(section => {
    const sourceSegments = sourceSegmentsBySection.get(section) ?? [];
    const outputValues = outputValuesBySection.get(section) ?? [];

    return {
      section,
      sourceSegmentCount: sourceSegments.length,
      unmatchedSourceSegmentCount: unmatchedSourceSegments.filter(
        segment => segment.section === section
      ).length,
      outputValueCount: outputValues.length,
      crossSectionOutputMatchCount: crossSectionOutputMatches.filter(
        outputValue => outputValue.section === section
      ).length,
      fieldMismatchOutputMatchCount: fieldMismatchOutputMatches.filter(
        outputValue => outputValue.section === section
      ).length,
      untracedOutputValueCount: untracedOutputValues.filter(
        outputValue => outputValue.section === section
      ).length,
    };
  });
}
