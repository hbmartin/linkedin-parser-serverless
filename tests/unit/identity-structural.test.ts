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
        text: 'www.linkedin.com/in/maria-de-souza',
        y: 740,
      }),
      line({ fontSize: 26, text: 'MARIA DE SOUZA', y: 760 }),
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
        linkedinUrl: 'https://linkedin.com/in/maria-de-souza',
        location: 'São Paulo, São Paulo, Brasil',
        name: 'MARIA DE SOUZA',
      })
    );
  });

  test('keeps company-at headlines and non-US locations', () => {
    const identity = IdentityStructuralParser.parse([
      line({ fontSize: 26, text: "Sean O'Neil", y: 760 }),
      line({ fontSize: 11, text: 'CTO @ Example Labs', y: 730 }),
      line({
        fontSize: 11,
        text: 'München, Bayern, Deutschland',
        y: 710,
      }),
      line({ fontSize: 16, text: 'Education', y: 680 }),
    ]);

    expect(identity.name).toBe("Sean O'Neil");
    expect(identity.headline).toBe('CTO @ Example Labs');
    expect(identity.location).toBe('München, Bayern, Deutschland');
  });

  test('keeps country-only locations out of the headline', () => {
    const identity = IdentityStructuralParser.parse([
      line({ fontSize: 26, text: 'Niko Le Mieux', y: 760 }),
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
});
