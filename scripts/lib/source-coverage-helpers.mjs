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

export function normalizeText(value) {
  return value
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[•·]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/([a-z])\.([A-Z])/g, '$1. $2')
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
    segments,
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
  const unmatchedSourceSegments = [];
  const looseSourceMatches = [];
  const untracedOutputValues = [];

  for (const segment of sourceView.segments) {
    const matchingOutputValues =
      outputValuesBySection.get(segment.section) ?? [];
    const match = bestTextMatch(
      segment.text,
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
    const matchingSourceSegments =
      sourceSegmentsBySection.get(outputValue.section) ?? [];
    const combinedSourceText = matchingSourceSegments
      .map(segment => segment.text)
      .join(' ');
    const match = bestTextMatch(outputValue.value, [combinedSourceText]);

    if (match.kind === 'none') {
      untracedOutputValues.push(outputValue);
    }
  }

  const sections = createSectionReports({
    outputValuesBySection,
    sourceSegmentsBySection,
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

  for (const variant of [
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
    `https://${withoutScheme}`,
    `https://${withoutSchemeAndUrlSpaces}`,
    `https://www.${withoutWww}`,
    `https://www.${withoutWwwAndUrlSpaces}`,
  ]) {
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
  outputValuesBySection,
  sourceSegmentsBySection,
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
      untracedOutputValueCount: untracedOutputValues.filter(
        outputValue => outputValue.section === section
      ).length,
    };
  });
}
