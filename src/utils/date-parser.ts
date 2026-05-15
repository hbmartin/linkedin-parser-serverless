import * as chrono from 'chrono-node';
import type { ParsedComponents, ParsedResult } from 'chrono-node';
import type { ParsedDateRange, ParsedProfileDate } from '../types/profile.js';

type ChronoParser = {
  parse(text: string): ParsedResult[];
};

interface DatePortion {
  text: string;
  durationText?: string;
}

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
  'ano',
  'anos',
  'mes',
  'mês',
  'meses',
];

const MONTH_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['jan', 'January'],
  ['janeiro', 'January'],
  ['janvier', 'January'],
  ['enero', 'January'],
  ['januar', 'January'],
  ['gennaio', 'January'],
  ['januari', 'January'],
  ['feb', 'February'],
  ['fevereiro', 'February'],
  ['février', 'February'],
  ['fevrier', 'February'],
  ['febrero', 'February'],
  ['februar', 'February'],
  ['febbraio', 'February'],
  ['februari', 'February'],
  ['mar', 'March'],
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
  ['mayo', 'May'],
  ['mai', 'May'],
  ['maggio', 'May'],
  ['mei', 'May'],
  ['jun', 'June'],
  ['junho', 'June'],
  ['juin', 'June'],
  ['junio', 'June'],
  ['juni', 'June'],
  ['giugno', 'June'],
  ['jul', 'July'],
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

export function parseProfileDateRange(
  text: string
): ParsedDateRange | undefined {
  const originalText = cleanDateText(text);

  if (!originalText) {
    return undefined;
  }

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

    if (!start && !end && !isCurrent) {
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

export function normalizeProfileDateText(text: string): string {
  return cleanDateText(text);
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
  start?: ParsedProfileDate;
}): ParsedDateRange {
  return {
    ...(durationText ? { durationText } : {}),
    ...(end ? { end } : {}),
    isCurrent,
    originalText,
    ...(start ? { start } : {}),
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

  return {
    iso: formatIsoDate({ day, month, precision, year }),
    precision,
    text: cleanDateText(text),
  };
}

function formatIsoDate({
  day,
  month,
  precision,
  year,
}: {
  day: number | null;
  month: number | null;
  precision: ParsedProfileDate['precision'];
  year: number;
}): string {
  if (precision === 'year') {
    return `${year}`;
  }

  const paddedMonth = String(month ?? 1).padStart(2, '0');

  if (precision === 'month') {
    return `${year}-${paddedMonth}`;
  }

  return `${year}-${paddedMonth}-${String(day ?? 1).padStart(2, '0')}`;
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
  const dotParts = text.split(/\s*[·|]\s*/);
  const durationText = dotParts
    .slice(1)
    .map(part => cleanDateText(part.replace(/[()]/g, '')))
    .find(part => containsDurationWord(part));
  const dateText = trimLeadingNonDateText(
    dotParts[0].replace(
      /\(([^)]*(?:yr|year|mo|month|ano|mes|mês)[^)]*)\)/iu,
      ''
    )
  );
  const parentheticalDuration = text.match(
    /\(([^)]*(?:yr|year|mo|month|ano|mes|mês)[^)]*)\)/iu
  );

  return {
    durationText:
      durationText ??
      (parentheticalDuration
        ? cleanDateText(parentheticalDuration[1])
        : undefined),
    text: cleanDateText(dateText),
  };
}

function trimLeadingNonDateText(text: string): string {
  const normalizedText = cleanDateText(text);
  const normalizedEnglishText = normalizeLocalizedDateText(normalizedText);
  const dateStartIndex = normalizedEnglishText.search(
    /\b(?:(?:19|20)\d{2}|January|February|March|April|May|June|July|August|September|October|November|December)\b/iu
  );

  return dateStartIndex <= 0
    ? normalizedText
    : normalizedText.slice(dateStartIndex).trim();
}

function splitDateRange(text: string): string[] {
  const rangeParts = text
    .split(/\s*-\s*/u)
    .map(part => cleanDateText(part))
    .filter(Boolean);

  return rangeParts.length > 1 ? rangeParts : [cleanDateText(text)];
}

function normalizeLocalizedDateText(text: string): string {
  let normalizedText = cleanDateText(text).toLowerCase();

  for (const [localizedMonth, englishMonth] of MONTH_REPLACEMENTS) {
    normalizedText = normalizedText.replace(
      new RegExp(
        `(^|[^\\p{L}])${escapeRegExp(localizedMonth)}([^\\p{L}]|$)`,
        'giu'
      ),
      `$1${englishMonth}$2`
    );
  }

  return normalizedText
    .replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:de|of|del|du)\s+((?:19|20)\d{2})\b/giu,
      '$1 $2'
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDateText(text: string): string {
  return text
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCurrentText(text: string): boolean {
  const normalizedText = cleanDateText(text).toLowerCase();

  return CURRENT_WORDS.some(word =>
    new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, 'iu').test(
      normalizedText
    )
  );
}

function containsDurationWord(text: string): boolean {
  const lowerText = text.toLowerCase();

  return DURATION_WORDS.some(word =>
    new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, 'iu').test(
      lowerText
    )
  );
}

function hasProfileDateSignal(text: string): boolean {
  return /\b(?:19|20)\d{2}\b/.test(text) || isCurrentText(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
