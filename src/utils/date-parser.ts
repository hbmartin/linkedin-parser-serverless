import * as chrono from 'chrono-node';
import type { ParsedComponents, ParsedResult } from 'chrono-node';
import type { ParsedDateRange, ParsedProfileDate } from '../types/profile.js';
import { BoundedStringCache } from './bounded-cache.js';

type ChronoParser = {
  parse(text: string): ParsedResult[];
};

interface DatePortion {
  readonly text: string;
  readonly durationText?: string;
}

const PARSED_DATE_RANGE_CACHE_LIMIT = 512;
const DATE_TEXT_CACHE_LIMIT = 1024;
const parsedDateRangeCache = new BoundedStringCache<
  ParsedDateRange | undefined
>(PARSED_DATE_RANGE_CACHE_LIMIT);
const cleanDateTextCache = new BoundedStringCache<string>(
  DATE_TEXT_CACHE_LIMIT
);
const datePortionCache = new BoundedStringCache<DatePortion>(
  DATE_TEXT_CACHE_LIMIT
);
const localizedDateTextCache = new BoundedStringCache<string>(
  DATE_TEXT_CACHE_LIMIT
);

const CHRONO_PARSERS: ChronoParser[] = [
  chrono.en.casual,
  chrono.pt.casual,
  chrono.es.casual,
  chrono.fr.casual,
  chrono.de.casual,
  chrono.it.casual,
  chrono.nl.casual,
];

const CURRENT_WORDS = [
  'present',
  'current',
  'presente',
  'atual',
  'présent',
  'presentes',
  'actual',
];

const DURATION_WORDS = [
  'yr',
  'yrs',
  'year',
  'years',
  'mo',
  'mos',
  'month',
  'months',
  'jahr',
  'jahre',
  'an',
  'ans',
  'ano',
  'anos',
  'anno',
  'anni',
  'mes',
  'mês',
  'meses',
  'mese',
  'mesi',
  'mois',
  'måned',
  'måneder',
  'år',
];

const MONTH_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['jan', 'January'],
  ['january', 'January'],
  ['janeiro', 'January'],
  ['janvier', 'January'],
  ['enero', 'January'],
  ['januar', 'January'],
  ['gennaio', 'January'],
  ['januari', 'January'],
  ['feb', 'February'],
  ['february', 'February'],
  ['fevereiro', 'February'],
  ['février', 'February'],
  ['fevrier', 'February'],
  ['febrero', 'February'],
  ['februar', 'February'],
  ['febbraio', 'February'],
  ['februari', 'February'],
  ['mar', 'March'],
  ['march', 'March'],
  ['março', 'March'],
  ['marco', 'March'],
  ['mars', 'March'],
  ['marzo', 'March'],
  ['märz', 'March'],
  ['maerz', 'March'],
  ['maart', 'March'],
  ['apr', 'April'],
  ['abril', 'April'],
  ['avril', 'April'],
  ['aprile', 'April'],
  ['april', 'April'],
  ['maio', 'May'],
  ['may', 'May'],
  ['mayo', 'May'],
  ['mai', 'May'],
  ['maggio', 'May'],
  ['mei', 'May'],
  ['jun', 'June'],
  ['june', 'June'],
  ['junho', 'June'],
  ['juin', 'June'],
  ['junio', 'June'],
  ['juni', 'June'],
  ['giugno', 'June'],
  ['jul', 'July'],
  ['july', 'July'],
  ['julho', 'July'],
  ['juillet', 'July'],
  ['julio', 'July'],
  ['juli', 'July'],
  ['luglio', 'July'],
  ['aug', 'August'],
  ['agosto', 'August'],
  ['août', 'August'],
  ['aout', 'August'],
  ['august', 'August'],
  ['sep', 'September'],
  ['sept', 'September'],
  ['setembro', 'September'],
  ['septembre', 'September'],
  ['septiembre', 'September'],
  ['september', 'September'],
  ['settembre', 'September'],
  ['oct', 'October'],
  ['out', 'October'],
  ['outubro', 'October'],
  ['octobre', 'October'],
  ['octubre', 'October'],
  ['oktober', 'October'],
  ['ottobre', 'October'],
  ['october', 'October'],
  ['nov', 'November'],
  ['novembro', 'November'],
  ['novembre', 'November'],
  ['noviembre', 'November'],
  ['november', 'November'],
  ['dec', 'December'],
  ['dez', 'December'],
  ['dezembro', 'December'],
  ['décembre', 'December'],
  ['decembre', 'December'],
  ['diciembre', 'December'],
  ['dezember', 'December'],
  ['dicembre', 'December'],
  ['december', 'December'],
];

const CURRENT_TEXT_PATTERN = createWordListPattern(CURRENT_WORDS);
const DURATION_UNIT_PATTERN_TEXT = DURATION_WORDS.map(escapeRegExp).join('|');
const DURATION_QUANTITY_PATTERN_TEXT = `\\d+\\s*(?:${DURATION_UNIT_PATTERN_TEXT})(?=[^\\p{L}]|$)`;
const DURATION_TEXT_PATTERN = new RegExp(
  `^(?:less\\s+than\\s+a\\s+year|${DURATION_QUANTITY_PATTERN_TEXT}(?:[\\s,]+${DURATION_QUANTITY_PATTERN_TEXT})*)$`,
  'iu'
);
const MONTH_REPLACEMENT_PATTERNS = MONTH_REPLACEMENTS.map(
  ([localizedMonth, englishMonth]) => ({
    englishMonth,
    pattern: new RegExp(
      `(^|[^\\p{L}])${escapeRegExp(localizedMonth)}(?=[^\\p{L}]|$)`,
      'giu'
    ),
  })
);
const COMPACT_YEAR_RANGE_PATTERN = new RegExp(
  `^((?:19|20)\\d{2})-((?:19|20)\\d{2}|${CURRENT_WORDS.map(escapeRegExp).join('|')})$`,
  'iu'
);

export function parseProfileDateRange(
  text: string
): ParsedDateRange | undefined {
  const originalText = cleanDateText(text);

  if (!originalText) {
    return undefined;
  }

  const cachedDateRange = parsedDateRangeCache.get(originalText);

  if (cachedDateRange.hit) {
    return cloneParsedDateRange(cachedDateRange.value);
  }

  const parsedDateRange = parseCleanProfileDateRange(originalText);
  parsedDateRangeCache.set(originalText, parsedDateRange);

  return cloneParsedDateRange(parsedDateRange);
}

function parseCleanProfileDateRange(
  originalText: string
): ParsedDateRange | undefined {
  if (!hasProfileDateSignal(originalText)) {
    return undefined;
  }

  const datePortion = extractDatePortion(originalText);
  const normalizedText = normalizeLocalizedDateText(datePortion.text);
  const rangeParts = splitDateRange(normalizedText);
  const isCurrent = rangeParts.some(isCurrentText);

  if (rangeParts.length >= 2) {
    const start = parseProfileDate(rangeParts[0]);
    const end = isCurrentText(rangeParts[1])
      ? undefined
      : parseProfileDate(rangeParts[1]);

    if (!start || (!end && !isCurrent)) {
      return undefined;
    }

    return createDateRange({
      durationText: datePortion.durationText,
      end,
      isCurrent,
      originalText,
      start,
    });
  }

  const chronoRange = parseWithChrono(normalizedText);
  if (chronoRange) {
    return createDateRange({
      durationText: datePortion.durationText,
      end: chronoRange.end,
      isCurrent,
      originalText,
      start: chronoRange.start,
    });
  }

  const start = parseProfileDate(normalizedText);

  if (!start) {
    return undefined;
  }

  return createDateRange({
    durationText: datePortion.durationText,
    isCurrent,
    originalText,
    start,
  });
}

function cloneParsedDateRange(
  parsedDateRange: ParsedDateRange | undefined
): ParsedDateRange | undefined {
  if (!parsedDateRange) {
    return undefined;
  }

  const base = {
    ...(parsedDateRange.durationText
      ? { durationText: parsedDateRange.durationText }
      : {}),
    originalText: parsedDateRange.originalText,
    start: { ...parsedDateRange.start },
  };

  if (parsedDateRange.kind === 'completed') {
    return {
      ...base,
      end: { ...parsedDateRange.end },
      kind: 'completed',
    };
  }

  if (parsedDateRange.kind === 'current') {
    return {
      ...base,
      kind: 'current',
    };
  }

  return {
    ...base,
    kind: 'single',
  };
}

export function extractProfileDateRangeText(text: string): string | undefined {
  const originalText = cleanDateText(text);

  if (!parseProfileDateRange(originalText)) {
    return undefined;
  }

  return extractDatePortion(originalText).text;
}

export function looksLikeDateRangeText(text: string): boolean {
  return parseProfileDateRange(text) !== undefined;
}

function createDateRange({
  durationText,
  end,
  isCurrent,
  originalText,
  start,
}: {
  durationText?: string;
  end?: ParsedProfileDate;
  isCurrent: boolean;
  originalText: string;
  start: ParsedProfileDate;
}): ParsedDateRange {
  const base = {
    ...(durationText ? { durationText } : {}),
    originalText,
    start,
  };

  if (isCurrent) {
    return {
      ...base,
      kind: 'current',
    };
  }

  if (end) {
    return {
      ...base,
      end,
      kind: 'completed',
    };
  }

  return {
    ...base,
    kind: 'single',
  };
}

function parseWithChrono(
  text: string
): { start: ParsedProfileDate; end?: ParsedProfileDate } | undefined {
  for (const parser of CHRONO_PARSERS) {
    const result = parser
      .parse(text)
      .find(candidate => candidate.text.trim().length >= 4);

    if (!result) {
      continue;
    }

    const start = createParsedProfileDate(result.start, result.text);

    if (!start) {
      continue;
    }

    return {
      end: result.end
        ? createParsedProfileDate(result.end, endTextFromChronoResult(result))
        : undefined,
      start,
    };
  }

  return undefined;
}

function parseProfileDate(text: string): ParsedProfileDate | undefined {
  const normalizedText = normalizeLocalizedDateText(text);
  const yearOnlyMatch = normalizedText.match(/^(19|20)\d{2}$/);

  if (yearOnlyMatch) {
    return {
      iso: normalizedText,
      precision: 'year',
      text: normalizedText,
    };
  }

  const isoMonthOrDayMatch = normalizedText.match(
    /^((?:19|20)\d{2})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/
  );

  if (isoMonthOrDayMatch) {
    const year = Number(isoMonthOrDayMatch[1]);
    const month = Number(isoMonthOrDayMatch[2]);
    const dayText = isoMonthOrDayMatch[3];

    if (dayText) {
      const day = Number(dayText);

      return {
        iso: formatIsoDate({ day, month, precision: 'day', year }),
        precision: 'day',
        text: normalizedText,
      };
    }

    return {
      iso: formatIsoDate({ month, precision: 'month', year }),
      precision: 'month',
      text: normalizedText,
    };
  }

  const chronoRange = parseWithChrono(normalizedText);

  return chronoRange?.start;
}

function createParsedProfileDate(
  components: ParsedComponents,
  text: string
): ParsedProfileDate | undefined {
  const year = components.get('year');

  if (!year) {
    return undefined;
  }

  const month = components.get('month');
  const day = components.get('day');
  const precision = components.isCertain('day')
    ? 'day'
    : components.isCertain('month')
      ? 'month'
      : 'year';

  if (precision === 'day') {
    if (!month || !day) {
      return undefined;
    }

    return {
      iso: formatIsoDate({ day, month, precision, year }),
      precision,
      text: cleanDateText(text),
    };
  }

  if (precision === 'month') {
    if (!month) {
      return undefined;
    }

    return {
      iso: formatIsoDate({ month, precision, year }),
      precision,
      text: cleanDateText(text),
    };
  }

  return {
    iso: formatIsoDate({ precision, year }),
    precision,
    text: cleanDateText(text),
  };
}

type FormatIsoDateParams =
  | {
      precision: 'year';
      year: number;
    }
  | {
      month: number;
      precision: 'month';
      year: number;
    }
  | {
      day: number;
      month: number;
      precision: 'day';
      year: number;
    };

function formatIsoDate(params: FormatIsoDateParams): string {
  const { precision, year } = params;

  if (precision === 'year') {
    return `${year}`;
  }

  const paddedMonth = String(params.month).padStart(2, '0');

  if (precision === 'month') {
    return `${year}-${paddedMonth}`;
  }

  return `${year}-${paddedMonth}-${String(params.day).padStart(2, '0')}`;
}

function endTextFromChronoResult(result: ParsedResult): string {
  if (!result.end) {
    return '';
  }

  const delimiterIndex = result.text.search(/\s[-–—]\s/);

  return delimiterIndex === -1
    ? result.text
    : result.text.slice(delimiterIndex + 3);
}

function extractDatePortion(text: string): DatePortion {
  return datePortionCache.getOrSet(text, () => {
    // LinkedIn often appends durations after a middle dot or pipe; keep the left
    // side as the date range while preserving duration text for the parsed result.
    const dotParts = text.split(/\s*[·|]\s*/);
    const durationText = dotParts
      .slice(1)
      .map(part => cleanDateText(part.replace(/[()]/g, '')))
      .find(part => looksLikeDurationText(part));
    const parentheticalDurationMatch = Array.from(
      dotParts[0].matchAll(/\(([^)]*)\)/gu)
    ).find(match => looksLikeDurationText(match[1]));
    const parentheticalDuration = parentheticalDurationMatch
      ? cleanDateText(parentheticalDurationMatch[1])
      : undefined;
    // Parenthetical durations belong in durationText, not in the chrono input.
    const dateText = trimTrailingNonDateParentheticalText(
      trimLeadingNonDateText(
        parentheticalDurationMatch
          ? dotParts[0].replace(parentheticalDurationMatch[0], '')
          : dotParts[0]
      )
    );

    return {
      durationText: durationText ?? parentheticalDuration,
      text: cleanDateText(dateText),
    };
  });
}

function trimTrailingNonDateParentheticalText(text: string): string {
  return cleanDateText(
    text.replace(/\s+\(([^)]*)\)\s*$/u, (match, content: string) =>
      hasProfileDateSignal(content) ? match : ''
    )
  );
}

function trimLeadingNonDateText(text: string): string {
  const normalizedText = cleanDateText(text);
  // Search the localized-normalized version so month names such as "janeiro"
  // are found using the same English month vocabulary chrono understands.
  const normalizedEnglishText = normalizeLocalizedDateText(normalizedText);
  // Find the first credible date token and discard leading prose like
  // "Provided support from" before handing the date portion to parsers.
  const dateStartIndex = normalizedEnglishText.search(
    /\b(?:(?:19|20)\d{2}|January|February|March|April|May|June|July|August|September|October|November|December)\b/iu
  );

  return dateStartIndex <= 0
    ? normalizedText
    : normalizedText.slice(dateStartIndex).trim();
}

function splitDateRange(text: string): string[] {
  // Require spaces around range separators so ISO dates and "Jan-2020" remain
  // single dates; compact year ranges are handled explicitly below.
  const rangeParts = text
    .split(/\s+-\s+/u)
    .map(part => cleanDateText(part))
    .filter(Boolean);

  if (rangeParts.length > 1) {
    return rangeParts;
  }

  const compactYearRange = cleanDateText(text).match(
    COMPACT_YEAR_RANGE_PATTERN
  );
  if (compactYearRange) {
    return [compactYearRange[1], compactYearRange[2]];
  }

  return [cleanDateText(text)];
}

function normalizeLocalizedDateText(text: string): string {
  return localizedDateTextCache.getOrSet(text, () => {
    let normalizedText = cleanDateText(text).toLowerCase();

    // Replace localized month names with English equivalents before chrono runs.
    for (const { englishMonth, pattern } of MONTH_REPLACEMENT_PATTERNS) {
      normalizedText = normalizedText.replace(pattern, `$1${englishMonth}`);
    }

    return (
      normalizedText
        // Collapse forms such as "março de 2024" or "March of 2024".
        .replace(
          /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:de|of|del|du)\s+((?:19|20)\d{2})\b/giu,
          '$1 $2'
        )
        // Normalize whitespace introduced by replacements and PDF extraction.
        .replace(/\s+/g, ' ')
        .trim()
    );
  });
}

function cleanDateText(text: string): string {
  return cleanDateTextCache.getOrSet(text, () =>
    text
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function isCurrentText(text: string): boolean {
  const normalizedText = cleanDateText(text).toLowerCase();

  return CURRENT_TEXT_PATTERN.test(normalizedText);
}

function looksLikeDurationText(text: string): boolean {
  const lowerText = cleanDateText(text).toLowerCase();

  return DURATION_TEXT_PATTERN.test(lowerText);
}

function hasProfileDateSignal(text: string): boolean {
  return /\b(?:19|20)\d{2}\b/.test(text) || isCurrentText(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createWordListPattern(words: readonly string[]): RegExp {
  return new RegExp(
    `(^|[^\\p{L}])(?:${words.map(escapeRegExp).join('|')})(?=[^\\p{L}]|$)`,
    'iu'
  );
}
