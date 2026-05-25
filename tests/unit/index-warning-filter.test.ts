import { jest } from '@jest/globals';
import { parseLinkedInPDF } from '../../src/index.js';
import { BasicInfoParser } from '../../src/parsers/basic-info.js';
import { EducationParser } from '../../src/parsers/education.js';
import { ExperienceStructuralParser } from '../../src/parsers/experience-structural.js';
import { ExtraSectionParser } from '../../src/parsers/extra-sections.js';
import { IdentityStructuralParser } from '../../src/parsers/identity-structural.js';
import { ListParser } from '../../src/parsers/lists.js';
import { StructuralParser } from '../../src/parsers/structural-parser.js';
import type { SectionParseWarning } from '../../src/types/profile.js';
import type { TextItem } from '../../src/types/structural.js';

const contactWarning: SectionParseWarning = {
  code: 'section_parse_warning',
  field: 'contact',
  message: 'Detected a contact section but could not extract contact fields',
  section: 'contact',
};

const summaryWarning: SectionParseWarning = {
  code: 'section_parse_warning',
  field: 'summary',
  message: 'Detected a summary section but could not extract summary text',
  section: 'summary',
};

describe('parseLinkedInPDF warning filtering', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('suppresses contact section warnings when structural identity resolves contact data', async () => {
    mockBinaryParse({
      basicInfoWarnings: [contactWarning, summaryWarning],
      linkedinUrl: 'https://linkedin.com/in/resolved-user',
    });

    const result = await parseLinkedInPDF(new Uint8Array([1, 2, 3]));

    expect(result.profile.contact.linkedin_url).toBe(
      'https://linkedin.com/in/resolved-user'
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining(summaryWarning)])
    );
    expect(result.warnings).not.toEqual(
      expect.arrayContaining([expect.objectContaining(contactWarning)])
    );
  });

  test('keeps contact section warnings when no contact data is resolved', async () => {
    mockBinaryParse({
      basicInfoWarnings: [contactWarning],
      linkedinUrl: undefined,
    });

    const result = await parseLinkedInPDF(new Uint8Array([1, 2, 3]));

    expect(result.profile.contact.linkedin_url).toBeUndefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining(contactWarning)])
    );
  });
});

function mockBinaryParse({
  basicInfoWarnings,
  linkedinUrl,
}: {
  basicInfoWarnings: SectionParseWarning[];
  linkedinUrl: string | undefined;
}): void {
  const textItem = createTextItem();

  jest.spyOn(StructuralParser, 'extractStructuredText').mockResolvedValue({
    layout: {
      type: 'single-column',
    },
    textItems: [textItem],
  });
  jest
    .spyOn(StructuralParser, 'groupTextByProximity')
    .mockReturnValue([[textItem]]);
  jest
    .spyOn(StructuralParser, 'combineGroupedText')
    .mockReturnValue([
      'Resolved User',
      'Principal Parser',
      'Contact',
      'Available on request',
      'Experience',
      'Example Labs',
      'Engineer',
      'January 2020 - Present',
    ]);
  jest.spyOn(BasicInfoParser, 'parseStructuralWithWarnings').mockReturnValue({
    value: {
      contact: {},
      headline: 'Principal Parser',
      location: 'Oakland, California, United States',
      name: 'Resolved User',
    },
    warnings: basicInfoWarnings,
  });
  jest.spyOn(IdentityStructuralParser, 'parseWithWarnings').mockReturnValue({
    value: {
      linkedinUrl,
      topSkills: [],
    },
    warnings: [],
  });
  jest.spyOn(ListParser, 'parseSkillsWithWarnings').mockReturnValue({
    value: [],
    warnings: [],
  });
  jest
    .spyOn(ListParser, 'parseStructuralLanguagesWithWarnings')
    .mockReturnValue({
      value: [],
      warnings: [],
    });
  jest
    .spyOn(ExtraSectionParser, 'parseStructuralWithWarnings')
    .mockReturnValue({
      value: {
        certifications: [],
        projects: [],
        publications: [],
        volunteer_work: [],
      },
      warnings: [],
    });
  jest
    .spyOn(ExperienceStructuralParser, 'parseExperienceWithWarnings')
    .mockReturnValue({
      value: [],
      warnings: [],
    });
  jest.spyOn(EducationParser, 'parseStructuralWithWarnings').mockReturnValue({
    value: [],
    warnings: [],
  });
  jest.spyOn(EducationParser, 'parseWithWarnings').mockReturnValue({
    value: [],
    warnings: [],
  });
}

function createTextItem(): TextItem {
  return {
    fontFamily: 'Helvetica',
    fontSize: 12,
    height: 12,
    text: 'Resolved User',
    width: 80,
    x: 220,
    y: 700,
  };
}
