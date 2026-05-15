import { ExtraSectionParser } from '../../src/parsers/extra-sections.js';
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
  test('extracts text fallback certifications, projects, and volunteer work', () => {
    const sections = ExtraSectionParser.parseText(`
      Test User
      test@example.com

      Certifications
      Cloud Architect Professional

      Projects
      Internal Search Migration

      Volunteer Experience
      Community Mentor

      Experience
      Example Labs
    `);

    expect(sections).toEqual({
      certifications: ['Cloud Architect Professional'],
      projects: ['Internal Search Migration'],
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
      line({ text: 'Education', y: 640 }),
    ]);

    expect(sections.certifications).toEqual(['AWS Solutions Architect']);
    expect(sections.projects).toEqual(['Revenue Forecasting Tool']);
    expect(sections.volunteer_work).toEqual(['Open Source Mentor']);
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
});
