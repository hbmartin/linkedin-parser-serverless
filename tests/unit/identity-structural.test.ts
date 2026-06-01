import { IdentityStructuralParser } from '../../src/parsers/identity-structural.js';
import type { StructuralLine } from '../../src/utils/structural-lines.js';

function line({
  column = 'right',
  fontSize = 10,
  text,
  y,
}: {
  column?: StructuralLine['column'];
  fontSize?: number;
  text: string;
  y: number;
}): StructuralLine {
  return {
    column,
    fontSize,
    height: fontSize,
    text,
    width: text.length * 5,
    x: column === 'left' ? 30 : 220,
    y,
  };
}

describe('IdentityStructuralParser', () => {
  test('uses the largest main-column identity line as the name', () => {
    const identity = IdentityStructuralParser.parse([
      line({ column: 'left', text: 'Contact', y: 760 }),
      line({
        column: 'left',
        text: 'www.linkedin.com/in/ariadne-minos',
        y: 740,
      }),
      line({ fontSize: 26, text: 'ARIADNE MINOS', y: 760 }),
      line({ fontSize: 11, text: 'Strategic Planning Advisor', y: 730 }),
      line({
        fontSize: 11,
        text: 'São Paulo, São Paulo, Brasil',
        y: 710,
      }),
      line({ fontSize: 16, text: 'Experience', y: 680 }),
    ]);

    expect(identity).toEqual(
      expect.objectContaining({
        headline: 'Strategic Planning Advisor',
        linkedinUrl: 'https://linkedin.com/in/ariadne-minos',
        location: 'São Paulo, São Paulo, Brasil',
        name: 'ARIADNE MINOS',
      })
    );
  });

  test('normalizes LinkedIn URLs split after the profile path', () => {
    const identity = IdentityStructuralParser.parse([
      line({ column: 'left', text: 'Contact', y: 760 }),
      line({ column: 'left', text: 'www.linkedin.com/in/', y: 740 }),
      line({ column: 'left', text: 'theseusaegeus (LinkedIn)', y: 720 }),
      line({ fontSize: 26, text: 'Theseus Aegeus', y: 760 }),
      line({ fontSize: 16, text: 'Experience', y: 700 }),
    ]);

    expect(identity.linkedinUrl).toBe('https://linkedin.com/in/theseusaegeus');
  });

  test('keeps company-at headlines and non-US locations', () => {
    const identity = IdentityStructuralParser.parse([
      line({ fontSize: 26, text: "Lugh O'Nuada", y: 760 }),
      line({ fontSize: 11, text: 'CTO @ Example Labs', y: 730 }),
      line({
        fontSize: 11,
        text: 'München, Bayern, Deutschland',
        y: 710,
      }),
      line({ fontSize: 16, text: 'Education', y: 680 }),
    ]);

    expect(identity.name).toBe("Lugh O'Nuada");
    expect(identity.headline).toBe('CTO @ Example Labs');
    expect(identity.location).toBe('München, Bayern, Deutschland');
  });

  test('keeps country-only locations out of the headline', () => {
    const identity = IdentityStructuralParser.parse([
      line({ fontSize: 26, text: 'Freya Vanir', y: 760 }),
      line({
        fontSize: 12,
        text: 'Web2.5 Finance & Payments Innovation',
        y: 730,
      }),
      line({ fontSize: 12, text: 'United States', y: 710 }),
      line({ fontSize: 16, text: 'Summary', y: 680 }),
    ]);

    expect(identity.headline).toBe('Web2.5 Finance & Payments Innovation');
    expect(identity.location).toBe('United States');
  });

  test('stops identity extraction at localized experience headers', () => {
    const identity = IdentityStructuralParser.parse([
      line({ fontSize: 26, text: 'Hauk Hofseth', y: 760 }),
      line({ fontSize: 12, text: 'Family Office Investments', y: 730 }),
      line({ fontSize: 12, text: 'USA', y: 710 }),
      line({ fontSize: 16, text: 'Erfaring', y: 680 }),
      line({ fontSize: 12, text: 'Private Office', y: 660 }),
      line({ fontSize: 11, text: 'Family Officer', y: 640 }),
    ]);

    expect(identity.headline).toBe('Family Office Investments');
    expect(identity.location).toBe('USA');
  });

  test('splits metropolitan area identity locations out of headlines', () => {
    const identity = IdentityStructuralParser.parse([
      line({ fontSize: 26, text: 'Victor Wu', y: 760 }),
      line({
        fontSize: 12,
        text: 'Consumer CFO | Pricing Strategy | P&L Management',
        y: 730,
      }),
      line({
        fontSize: 12,
        text: 'Salt Lake City Metropolitan Area',
        y: 710,
      }),
      line({ fontSize: 16, text: 'Experience', y: 680 }),
    ]);

    expect(identity.headline).toBe(
      'Consumer CFO | Pricing Strategy | P&L Management'
    );
    expect(identity.location).toBe('Salt Lake City Metropolitan Area');
  });

  test('returns warnings for malformed sidebar sections without identity candidates', () => {
    const result = IdentityStructuralParser.parseWithWarnings([
      line({ column: 'left', text: 'Contact', y: 760 }),
      line({ column: 'left', text: 'linkedin.com/in/', y: 740 }),
      line({ column: 'left', text: 'Top Skills', y: 720 }),
      line({ column: 'left', text: 'Languages', y: 700 }),
      line({ fontSize: 16, text: 'Experience', y: 760 }),
    ]);

    expect(result.value).toEqual({
      headline: undefined,
      linkedinUrl: undefined,
      location: undefined,
      name: undefined,
      topSkills: [],
    });
    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'section',
        section: 'top_skills',
      }),
      expect.objectContaining({
        field: 'linkedin_url',
        section: 'contact',
      }),
    ]);
  });

  test('uses a later larger identity line and unbounded top skills', () => {
    const identity = IdentityStructuralParser.parse([
      line({ column: 'left', text: 'Top Skills', y: 760 }),
      line({ column: 'left', text: 'TypeScript', y: 740 }),
      line({ column: 'left', text: 'Product Strategy', y: 720 }),
      line({ fontSize: 12, text: 'Technical Advisor', y: 760 }),
      line({ fontSize: 26, text: 'Artemis Selene', y: 730 }),
    ]);

    expect(identity).toEqual({
      headline: undefined,
      linkedinUrl: undefined,
      location: undefined,
      name: 'Artemis Selene',
      topSkills: ['TypeScript', 'Product Strategy'],
    });
  });

  test('merges wrapped top skill lines in the same sidebar column', () => {
    const identity = IdentityStructuralParser.parse([
      line({ column: 'left', text: 'Top Skills', y: 760 }),
      line({ column: 'left', text: 'Cross-Functional Team', y: 740 }),
      line({ column: 'left', text: 'Management', y: 728 }),
      line({
        column: 'left',
        text: 'Qualitative & Quantitative Research',
        y: 704,
      }),
      line({ column: 'left', text: 'Methodologies', y: 692 }),
      line({ column: 'left', text: 'Languages', y: 660 }),
      line({ fontSize: 26, text: 'Ariadne Minos', y: 760 }),
    ]);

    expect(identity.topSkills).toEqual([
      'Cross-Functional Team Management',
      'Qualitative & Quantitative Research Methodologies',
    ]);
  });
});
