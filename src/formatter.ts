import type {
  Contact,
  Education,
  Experience,
  Language,
  LinkedInProfile,
} from './types/profile.js';

export interface FormatLinkedInProfileOptions {
  includeContact?: boolean;
  outputFormat?: LinkedInProfileOutputFormat;
}

export type LinkedInProfileOutputFormat = 'plainText' | 'markdown';

type SectionDraft = IdentitySectionDraft | TitledSectionDraft;

interface IdentitySectionDraft {
  hasProfileName: boolean;
  kind: 'identity';
  lines: string[];
}

interface TitledSectionDraft {
  kind: 'titled';
  lines: string[];
  title: string;
}

export function formatLinkedInProfile(
  profile: LinkedInProfile,
  options: FormatLinkedInProfileOptions = {}
): string {
  const outputFormat = options.outputFormat ?? 'plainText';
  const sections = [
    createIdentitySection(profile),
    options.includeContact ? createContactSection(profile.contact) : undefined,
    createSingleValueSection('Summary', profile.summary),
    createExperienceSection(profile.experience),
    createEducationSection(profile.education),
    createListSection('Top Skills', profile.top_skills),
    createLanguageSection(profile.languages),
    createListSection('Certifications', profile.certifications),
    createListSection('Volunteer Work', profile.volunteer_work),
    createListSection('Projects', profile.projects),
    createListSection('Publications', profile.publications),
    createListSection('Patents', profile.patents),
    createListSection('Organizations', profile.organizations),
    createListSection('Honors & Awards', profile.honors_awards),
  ].filter((section): section is SectionDraft => section !== undefined);

  return sections
    .map(section =>
      outputFormat === 'markdown'
        ? formatMarkdownSection(section)
        : formatPlainTextSection(section)
    )
    .join('\n\n')
    .trim();
}

function createIdentitySection(
  profile: LinkedInProfile
): SectionDraft | undefined {
  const name = cleanValue(profile.name);
  const lines = cleanValues([name, profile.headline, profile.location]);

  if (lines.length === 0) {
    return undefined;
  }

  return {
    hasProfileName: name !== undefined,
    kind: 'identity',
    lines,
  };
}

function createContactSection(contact: Contact): SectionDraft | undefined {
  const linkedinUrl = cleanValue(contact.linkedin_url);
  const normalizedLinkedInUrl =
    linkedinUrl === undefined
      ? undefined
      : normalizeContactUrlForDedupe(linkedinUrl);
  const linkLines =
    contact.links?.map(link => {
      if (!link) {
        return undefined;
      }

      const label = cleanValue(link.label);
      const url = cleanValue(link.url);

      // Treat an empty url or a url matching linkedinUrl as absent, dropping malformed rows and duplicate LinkedIn lines.
      if (
        !url ||
        (normalizedLinkedInUrl !== undefined &&
          normalizeContactUrlForDedupe(url) === normalizedLinkedInUrl)
      ) {
        return undefined;
      }

      return label ? `${label}: ${url}` : url;
    }) ?? [];
  const lines = cleanValues([
    contact.email ? `Email: ${contact.email}` : undefined,
    contact.phone ? `Phone: ${contact.phone}` : undefined,
    linkedinUrl ? `LinkedIn: ${linkedinUrl}` : undefined,
    contact.location ? `Location: ${contact.location}` : undefined,
    ...linkLines,
  ]);

  if (lines.length === 0) {
    return undefined;
  }

  return {
    kind: 'titled',
    lines,
    title: 'Contact',
  };
}

function normalizeContactUrlForDedupe(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?/u, '')
    .replace(/\/+$/u, '');
}

function createSingleValueSection(
  title: string,
  value: string | undefined
): SectionDraft | undefined {
  const cleanedValue = cleanValue(value);

  if (!cleanedValue) {
    return undefined;
  }

  return {
    kind: 'titled',
    lines: [cleanedValue],
    title,
  };
}

function createExperienceSection(
  experience: Experience[]
): SectionDraft | undefined {
  const lines = separateEntryLines(experience.map(formatExperience));

  if (lines.length === 0) {
    return undefined;
  }

  return {
    kind: 'titled',
    lines,
    title: 'Experience',
  };
}

function createEducationSection(
  education: Education[]
): SectionDraft | undefined {
  const lines = separateEntryLines(education.map(formatEducation));

  if (lines.length === 0) {
    return undefined;
  }

  return {
    kind: 'titled',
    lines,
    title: 'Education',
  };
}

function createListSection(
  title: string,
  values: string[]
): SectionDraft | undefined {
  const lines = cleanValues(values).map(value => `- ${value}`);

  if (lines.length === 0) {
    return undefined;
  }

  return {
    kind: 'titled',
    lines,
    title,
  };
}

function createLanguageSection(
  languages: Language[]
): SectionDraft | undefined {
  const lines = languages
    .map(language => {
      const languageName = cleanValue(language.language);
      const proficiency = cleanValue(language.proficiency);

      if (!languageName) {
        return undefined;
      }

      return proficiency && proficiency !== 'Unknown'
        ? `- ${languageName} (${proficiency})`
        : `- ${languageName}`;
    })
    .filter((line): line is string => line !== undefined);

  if (lines.length === 0) {
    return undefined;
  }

  return {
    kind: 'titled',
    lines,
    title: 'Languages',
  };
}

function formatExperience(experience: Experience): string[] {
  const title = cleanValue(experience.title);
  const company = cleanValue(experience.company);
  const headline =
    title && company
      ? `${title} at ${company}`
      : (title ?? company ?? undefined);
  const detailLines = cleanValues([
    experience.duration,
    experience.location,
    experience.description,
  ]);

  return cleanValues([headline, ...detailLines]);
}

function formatEducation(education: Education): string[] {
  const degree = cleanValue(education.degree);
  const institution = cleanValue(education.institution);
  const headline =
    degree && institution
      ? `${degree}, ${institution}`
      : (degree ?? institution ?? undefined);
  const detailLines = cleanValues([
    education.year,
    education.location,
    education.description,
  ]);

  return cleanValues([headline, ...detailLines]);
}

function formatPlainTextSection(section: SectionDraft): string {
  return section.kind === 'titled'
    ? [section.title, ...section.lines].join('\n')
    : section.lines.join('\n');
}

function formatMarkdownSection(section: SectionDraft): string {
  if (section.kind === 'titled') {
    return [`## ${section.title}`, ...section.lines].join('\n');
  }

  if (!section.hasProfileName) {
    return section.lines.join('\n');
  }

  const [name, ...details] = section.lines;

  return [`# ${name}`, ...details].join('\n');
}

function cleanValues(values: Array<string | undefined>): string[] {
  return values
    .map(value => cleanValue(value))
    .filter((value): value is string => value !== undefined);
}

function separateEntryLines(entries: string[][]): string[] {
  return entries
    .filter(entryLines => entryLines.length > 0)
    .flatMap((entryLines, index) =>
      index > 0 ? ['', ...entryLines] : entryLines
    );
}

function cleanValue(value: string | undefined): string | undefined {
  const cleanedValue = value
    ?.replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedValue && cleanedValue.length > 0 ? cleanedValue : undefined;
}
