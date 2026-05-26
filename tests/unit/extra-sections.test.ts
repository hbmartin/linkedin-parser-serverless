import {
  ExtraSectionParser,
  filterMergedSectionWarnings,
} from '../../src/parsers/extra-sections.js';
import type { SectionParseWarning } from '../../src/types/profile.js';
import type { StructuralLine } from '../../src/utils/structural-lines.js';

function line({
  column = 'right',
  text,
  y,
}: {
  column?: StructuralLine['column'];
  text: string;
  y: number;
}): StructuralLine {
  return {
    column,
    fontSize: 10,
    height: 10,
    text,
    width: text.length * 5,
    x: column === 'left' ? 30 : 220,
    y,
  };
}

describe('ExtraSectionParser', () => {
  test('extracts text fallback certifications, projects, publications, and volunteer work', () => {
    const sections = ExtraSectionParser.parseText(`
      Apollo Helios
      apollo@example.com

      Certifications
      Cloud Architect Professional

      Projects
      Internal Search Migration

      Publications
      Scaling Engineering Teams

      Volunteer Experience
      Community Mentor

      Experience
      Example Labs
    `);

    expect(sections).toEqual({
      certifications: ['Cloud Architect Professional'],
      honors_awards: [],
      projects: ['Internal Search Migration'],
      publications: ['Scaling Engineering Teams'],
      volunteer_work: ['Community Mentor'],
    });
  });

  test('extracts structural sections per visual column', () => {
    const sections = ExtraSectionParser.parseStructural([
      line({ column: 'left', text: 'Licenses & Certifications', y: 760 }),
      line({ column: 'left', text: 'AWS Solutions Architect', y: 740 }),
      line({ column: 'left', text: 'Languages', y: 700 }),
      line({ text: 'Projects', y: 760 }),
      line({ text: 'Revenue Forecasting Tool', y: 740 }),
      line({ text: 'Volunteer Work', y: 700 }),
      line({ text: 'Open Source Mentor', y: 680 }),
      line({ text: 'Publications', y: 640 }),
      line({ text: 'Distributed Systems Notes', y: 620 }),
      line({ text: 'Education', y: 640 }),
    ]);

    expect(sections.certifications).toEqual(['AWS Solutions Architect']);
    expect(sections.projects).toEqual(['Revenue Forecasting Tool']);
    expect(sections.publications).toEqual(['Distributed Systems Notes']);
    expect(sections.volunteer_work).toEqual(['Open Source Mentor']);
  });

  test('extracts honors-awards as a supported extra section', () => {
    const sections = ExtraSectionParser.parseStructural([
      line({ column: 'left', text: 'Honors-Awards', y: 760 }),
      line({
        column: 'left',
        text: 'Defender of the Declaration Award',
        y: 740,
      }),
      line({ column: 'left', text: 'Winner', y: 728 }),
      line({ column: 'left', text: 'Experience', y: 700 }),
    ]);

    expect(sections.honors_awards).toEqual([
      'Defender of the Declaration Award Winner',
    ]);
  });

  test('merges wrapped structural extra section entries', () => {
    const sections = ExtraSectionParser.parseStructural([
      line({ column: 'left', text: 'Certifications', y: 760 }),
      line({
        column: 'left',
        text: 'MITx 14.310Fx: Data Analysis in',
        y: 740,
      }),
      line({ column: 'left', text: 'Social Science', y: 728 }),
      line({
        column: 'left',
        text: 'Certificate of Completion - 23 hours',
        y: 708,
      }),
      line({
        column: 'left',
        text: 'of Android development training',
        y: 696,
      }),
      line({ column: 'left', text: 'Experience', y: 660 }),
    ]);

    expect(sections.certifications).toEqual([
      'MITx 14.310Fx: Data Analysis in Social Science',
      'Certificate of Completion - 23 hours of Android development training',
    ]);
  });

  test('stops extra section capture at normalized registry boundaries', () => {
    const sections = ExtraSectionParser.parseText(`
      Certificações e Licenças
      Cloud Architect Professional

      Competências
      TypeScript
    `);

    expect(sections.certifications).toEqual(['Cloud Architect Professional']);
  });

  test('returns warnings for detected empty extra sections', () => {
    const result = ExtraSectionParser.parseTextWithWarnings(`
      Certifications

      Experience
      Example Labs
    `);

    expect(result.value.certifications).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'section',
        section: 'certifications',
      }),
    ]);
  });

  test('suppresses structural empty-column warnings after merged entries exist', () => {
    const result = ExtraSectionParser.parseStructuralWithWarnings([
      line({ column: 'left', text: 'Certifications', y: 760 }),
      line({ column: 'left', text: 'Cloud Architect Professional', y: 740 }),
      line({ column: 'right', text: 'Certifications', y: 760 }),
      line({ column: 'right', text: 'Experience', y: 740 }),
    ]);

    expect(result.value.certifications).toEqual([
      'Cloud Architect Professional',
    ]);
    expect(result.warnings).toEqual([]);
  });

  test('preserves non-section warnings while filtering merged section warnings', () => {
    const nonSectionWarning: SectionParseWarning = {
      code: 'section_parse_warning',
      field: 'entry',
      message: 'Discarded malformed project entry',
      rawText: 'Project without details',
      section: 'projects',
    };
    const warnings: SectionParseWarning[] = [
      {
        code: 'section_parse_warning',
        field: 'section',
        message:
          'Detected a certifications section but could not extract entries',
        section: 'certifications',
      },
      nonSectionWarning,
    ];

    const filteredWarnings = filterMergedSectionWarnings({
      sections: {
        certifications: ['Cloud Architect Professional'],
        honors_awards: [],
        projects: [],
        publications: [],
        volunteer_work: [],
      },
      warnings,
    });

    expect(filteredWarnings).toEqual([nonSectionWarning]);
  });

  test('keeps unrelated section warnings and deduplicates merged empty warnings', () => {
    const summaryWarning: SectionParseWarning = {
      code: 'section_parse_warning',
      field: 'section',
      message: 'Detected a summary section but could not extract entries',
      section: 'summary',
    };
    const firstProjectWarning: SectionParseWarning = {
      code: 'section_parse_warning',
      field: 'section',
      message: 'Detected a projects section but could not extract entries',
      section: 'projects',
    };
    const duplicateProjectWarning: SectionParseWarning = {
      code: 'section_parse_warning',
      field: 'section',
      message: 'Detected a projects section but could not extract entries',
      section: 'projects',
    };

    const filteredWarnings = filterMergedSectionWarnings({
      sections: {
        certifications: [],
        honors_awards: [],
        projects: [],
        publications: [],
        volunteer_work: [],
      },
      warnings: [summaryWarning, firstProjectWarning, duplicateProjectWarning],
    });

    expect(filteredWarnings).toEqual([summaryWarning, firstProjectWarning]);
  });
});
