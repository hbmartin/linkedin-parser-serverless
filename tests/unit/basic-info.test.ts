import { BasicInfoParser } from '../../src/parsers/basic-info.js';
import type { StructuralLine } from '../../src/utils/structural-lines.js';

interface LocalizedHeaderWarningCase {
  readonly alias: string;
  readonly field: 'contact' | 'summary';
  readonly language: string;
  readonly section: 'contact' | 'summary';
}

describe('BasicInfoParser', () => {
  test('does not classify spaced email addresses as short company headlines', () => {
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      name @ domain.com
      Senior Engineer @ ExampleCo
      Los Angeles, California, United States
    `);

    expect(profile.headline).toBe('Senior Engineer @ ExampleCo');
  });

  test('extracts generic names without exclusion words or ASCII-only assumptions', () => {
    const strategicProfile = BasicInfoParser.parse(`
      Strategic Planning
      strategic.planning@custom.dev
      Principal Advisor
      München, Bayern, Deutschland
    `);
    const portugueseProfile = BasicInfoParser.parse(`
      ARIADNE MINOS
      ariadne.minos@example.com.br
      São Paulo, São Paulo, Brasil
    `);
    const apostropheProfile = BasicInfoParser.parse(`
      Lugh O'Nuada
      lugh.onuada@example.consulting
      Dublin, Leinster, Ireland
    `);

    expect(strategicProfile.name).toBe('Strategic Planning');
    expect(strategicProfile.location).toBe('München, Bayern, Deutschland');
    expect(portugueseProfile.name).toBe('ARIADNE MINOS');
    expect(portugueseProfile.location).toBe('São Paulo, São Paulo, Brasil');
    expect(apostropheProfile.name).toBe("Lugh O'Nuada");
  });

  test('omits email instead of returning an empty string', () => {
    const profile = BasicInfoParser.parse(`
      Persephone Kore
      Product Advisor
      Toronto, Ontario, Canada
    `);

    expect(profile.contact.email).toBeUndefined();
  });

  test('does not emit basic-info warnings for later empty sections', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      Principal Advisor
      Toronto, Ontario, Canada

      Experience
      Example Labs
      Summary
      Contact
    `);

    expect(result.warnings).toEqual([]);
  });

  test('does not scan boundary sections while looking for header warnings', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      Principal Advisor

      Patents
      Summary
    `);

    expect(result.warnings).toEqual([]);
  });

  test('reports adjacent empty contact and summary sections in the header', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      Principal Advisor
      Contact
      Available on request
      Summary
    `);

    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'contact',
        section: 'contact',
      }),
      expect.objectContaining({
        field: 'summary',
        section: 'summary',
      }),
    ]);
  });

  for (const contactHeader of ['Contatta', 'Contatti']) {
    test(`recognizes the Italian ${contactHeader} header as a contact section`, () => {
      const result = BasicInfoParser.parseWithWarnings(`
        Apollo Helios
        Principal Advisor
        ${contactHeader}
        Available on request
        Experience
      `);

      expect(result.warnings).toEqual([
        expect.objectContaining({
          field: 'contact',
          section: 'contact',
        }),
      ]);
    });
  }

  const localizedHeaderWarningCases: readonly LocalizedHeaderWarningCase[] = [
    {
      alias: 'forbindelse',
      field: 'contact',
      language: 'Danish',
      section: 'contact',
    },
    {
      alias: 'kontakt',
      field: 'contact',
      language: 'Norwegian',
      section: 'contact',
    },
    {
      alias: 'coordonnées',
      field: 'contact',
      language: 'French',
      section: 'contact',
    },
    {
      alias: 'riepilogo',
      field: 'summary',
      language: 'Italian',
      section: 'summary',
    },
  ];

  test.each(localizedHeaderWarningCases)(
    'recognizes the $language $alias header as a $section section warning',
    ({ alias, field, section }) => {
      const result = BasicInfoParser.parseWithWarnings(`
        Apollo Helios
        Principal Advisor
        ${alias}
        Available on request
        Experience
      `);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field,
          section,
        })
      );
    }
  );

  test('stops header warnings at later target sections', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      Principal Advisor
      Contact

      Experience
      Example Labs
      Summary
    `);

    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'contact',
        section: 'contact',
      }),
    ]);
  });

  test('stops header warnings at boundary sections', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      Principal Advisor
      Contact

      Courses
      Summary
    `);

    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'contact',
        section: 'contact',
      }),
    ]);
  });

  test('extracts structural summary from its visual column', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Apollo Helios',
        'Principal Advisor',
        'Toronto, Ontario, Canada',
        'Summary',
        'TypeScript',
        'Builds products across engineering and operations.',
        'Languages',
        'English (Native or Bilingual)',
        'with focus on reliable delivery and maintainable systems.',
        'Experience',
      ].join('\n'),
      [
        structuralLine({ column: 'right', text: 'Summary', y: 700 }),
        structuralLine({ column: 'left', text: 'TypeScript', y: 690 }),
        structuralLine({
          column: 'right',
          text: 'Builds products across engineering and operations.',
          y: 690,
        }),
        structuralLine({ column: 'left', text: 'Languages', y: 680 }),
        structuralLine({
          column: 'left',
          text: 'English (Native or Bilingual)',
          y: 670,
        }),
        structuralLine({
          column: 'right',
          text: 'with focus on reliable delivery and maintainable systems.',
          y: 670,
        }),
        structuralLine({ column: 'right', text: 'Experience', y: 660 }),
      ]
    );

    expect(result.value.summary).toBe(
      'Builds products across engineering and operations. with focus on reliable delivery and maintainable systems.'
    );
  });

  test('recognizes localized structural summary boundaries', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      ['Riepilogo', 'Builds market expansion systems.', 'Esperienza'].join(
        '\n'
      ),
      [
        structuralLine({ column: 'right', text: 'Riepilogo', y: 700 }),
        structuralLine({
          column: 'right',
          text: 'Builds market expansion systems.',
          y: 680,
        }),
        structuralLine({ column: 'right', text: 'Esperienza', y: 660 }),
      ]
    );

    expect(result.value.summary).toBe('Builds market expansion systems.');
  });

  test('keeps short structural summary continuation lines', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      ['Summary', 'Long enough summary line', 'my life.', 'Experience'].join(
        '\n'
      ),
      [
        structuralLine({ column: 'right', text: 'Summary', y: 700 }),
        structuralLine({
          column: 'right',
          text: 'Long enough summary line',
          y: 680,
        }),
        structuralLine({ column: 'right', text: 'my life.', y: 660 }),
        structuralLine({ column: 'right', text: 'Experience', y: 640 }),
      ]
    );

    expect(result.value.summary).toBe('Long enough summary line my life.');
  });

  test('covers fallback headline and summary branch outcomes directly', () => {
    expect(
      BasicInfoParser['extractHeadline'](
        ['Apollo Helios', 'Product | Engineering'].join('\n')
      )
    ).toBeUndefined();

    const longSummaryLine =
      'Builds durable platform systems for operating teams with enough detail to exceed the fallback parser stop threshold.';

    expect(
      BasicInfoParser['extractSummary'](
        [
          'Alpha',
          'Beta',
          'Gamma',
          'Delta',
          'Epsilon',
          longSummaryLine,
          'This later line should not be reached by fallback parsing.',
        ].join('\n')
      )
    ).toBe(longSummaryLine);

    expect(
      BasicInfoParser['extractStructuralSummary']([
        structuralLine({ column: 'right', text: 'Summary', y: 700 }),
        structuralLine({ column: 'right', text: 'short', y: 690 }),
      ])
    ).toBeUndefined();
  });

  test('skips blank identity lines while finding header warning boundaries', () => {
    const result = BasicInfoParser.parseWithWarnings(
      ['Apollo Helios', '', 'Contact'].join('\n')
    );

    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'contact',
        section: 'contact',
      }),
    ]);
  });

  test('extracts pipe-delimited headlines and phone contact fields', () => {
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      Product | Engineering | Operations
      Los Angeles, California, United States
      test.user@example.com
      (415) 5555-0101
    `);

    expect(profile.headline).toBe('Product | Engineering | Operations');
    expect(profile.contact).toEqual(
      expect.objectContaining({
        email: 'test.user@example.com',
        phone: '(415) 5555-0101',
      })
    );
  });

  test('extracts whitespace-labeled email lines from the header', () => {
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      Principal Advisor
      Email apollo@example.com
    `);

    expect(profile.contact.email).toBe('apollo@example.com');
  });

  test('extracts wrapped email continuations from header contact lines', () => {
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      Principal Advisor
      apollo@example.
      com
    `);

    expect(profile.contact.email).toBe('apollo@example.com');
  });

  test('extracts wrapped email continuations up to the practical TLD limit', () => {
    const longTld = 'abcdefghijklmnopqrstuvwx';
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      Principal Advisor
      apollo@example.
      ${longTld}
    `);

    expect(profile.contact.email).toBe(`apollo@example.${longTld}`);
  });

  test('does not stitch overly long wrapped email continuations', () => {
    const overlongTld = 'abcdefghijklmnopqrstuvwxy';
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      Principal Advisor
      apollo@example.
      ${overlongTld}
    `);

    expect(profile.contact.email).toBeUndefined();
  });

  test('extracts structural contact links while ignoring URL path digits as phones', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Contact',
        'www.linkedin.com/in/example',
        '(LinkedIn)',
        'siteresources.worldbank.org/',
        'INTPSD/',
        'Resources/336195-1092412588749/',
        'Algeria--ICA~3.pdf (Other)',
      ].join('\n'),
      [
        structuralLine({ column: 'left', text: 'Contact', y: 760 }),
        structuralLine({
          column: 'left',
          text: 'www.linkedin.com/in/example',
          y: 740,
        }),
        structuralLine({ column: 'left', text: '(LinkedIn)', y: 728 }),
        structuralLine({
          column: 'left',
          text: 'siteresources.worldbank.org/',
          y: 708,
        }),
        structuralLine({ column: 'left', text: 'INTPSD/', y: 696 }),
        structuralLine({
          column: 'left',
          text: 'Resources/336195-1092412588749/',
          y: 684,
        }),
        structuralLine({
          column: 'left',
          text: 'Algeria--ICA~3.pdf (Other)',
          y: 672,
        }),
        structuralLine({ column: 'left', text: 'Top Skills', y: 640 }),
      ]
    );

    expect(result.value.contact.phone).toBeUndefined();
    expect(result.value.contact.links).toEqual([
      expect.objectContaining({
        label: 'LinkedIn',
        url: 'https://linkedin.com/in/example',
      }),
      expect.objectContaining({
        label: 'Other',
        url: 'https://siteresources.worldbank.org/INTPSD/Resources/336195-1092412588749/Algeria--ICA~3.pdf',
      }),
    ]);
  });

  test('extracts generalized structural contact link labels and wrapped URL fragments', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Contact',
        'www.tiagotc.com (Personal)',
        'www.crunchbase.com/person/',
        'alextishakov (Portfolio)',
        'club.forbes.ru/forbesclub/kak-',
        'bolshie-dannye-pomogajut-pobedit-',
        'rak (Personal)',
        'Top Skills',
      ].join('\n'),
      [
        structuralLine({ column: 'left', text: 'Contact', y: 760 }),
        structuralLine({
          column: 'left',
          text: 'www.tiagotc.com (Personal)',
          y: 740,
        }),
        structuralLine({
          column: 'left',
          text: 'www.crunchbase.com/person/',
          y: 720,
        }),
        structuralLine({
          column: 'left',
          text: 'alextishakov (Portfolio)',
          y: 700,
        }),
        structuralLine({
          column: 'left',
          text: 'club.forbes.ru/forbesclub/kak-',
          y: 680,
        }),
        structuralLine({
          column: 'left',
          text: 'bolshie-dannye-pomogajut-pobedit-',
          y: 660,
        }),
        structuralLine({
          column: 'left',
          text: 'rak (Personal)',
          y: 640,
        }),
        structuralLine({ column: 'left', text: 'Top Skills', y: 620 }),
      ]
    );

    expect(result.value.contact.links).toEqual([
      expect.objectContaining({
        label: 'Personal',
        url: 'https://www.tiagotc.com',
      }),
      expect.objectContaining({
        label: 'Portfolio',
        url: 'https://www.crunchbase.com/person/alextishakov',
      }),
      expect.objectContaining({
        label: 'Personal',
        url: 'https://club.forbes.ru/forbesclub/kak-bolshie-dannye-pomogajut-pobedit-rak',
      }),
    ]);
  });

  test('extracts localized structural contact link labels', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Contact',
        'www.ejemplo.es (Portafólio)',
        'www.example.ru/projects (Проекты)',
        'Top Skills',
      ].join('\n'),
      [
        structuralLine({ column: 'left', text: 'Contact', y: 760 }),
        structuralLine({
          column: 'left',
          text: 'www.ejemplo.es (Portafólio)',
          y: 740,
        }),
        structuralLine({
          column: 'left',
          text: 'www.example.ru/projects (Проекты)',
          y: 720,
        }),
        structuralLine({ column: 'left', text: 'Top Skills', y: 700 }),
      ]
    );

    expect(result.value.contact.links).toEqual([
      expect.objectContaining({
        label: 'Portafólio',
        url: 'https://www.ejemplo.es',
      }),
      expect.objectContaining({
        label: 'Проекты',
        url: 'https://www.example.ru/projects',
      }),
    ]);
  });

  test('does not extract structural contact email from summary text', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Contact',
        'www.linkedin.com/in/jd-example',
        'Summary',
        'JD can be reached at jd@example.com.',
        'Experience',
      ].join('\n'),
      [
        structuralLine({ column: 'left', text: 'Contact', y: 760 }),
        structuralLine({
          column: 'left',
          text: 'www.linkedin.com/in/jd-example',
          y: 740,
        }),
        structuralLine({ column: 'right', text: 'Summary', y: 720 }),
        structuralLine({
          column: 'right',
          text: 'JD can be reached at jd@example.com.',
          y: 700,
        }),
        structuralLine({ column: 'right', text: 'Experience', y: 680 }),
      ]
    );

    expect(result.value.contact.email).toBeUndefined();
    expect(result.value.contact.linkedin_url).toBe(
      'https://linkedin.com/in/jd-example'
    );
    expect(result.value.summary).toBe('JD can be reached at jd@example.com.');
  });

  test('extracts wrapped structural contact email continuation lines', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Contact',
        '+1 310 498 3047 (Mobile)',
        'stephan.agerman@slvventure.',
        'com',
        'www.linkedin.com/in/stephan-',
        'agerman (LinkedIn)',
        'Summary',
      ].join('\n'),
      [
        structuralLine({ column: 'left', text: 'Contact', y: 760 }),
        structuralLine({
          column: 'left',
          text: '+1 310 498 3047 (Mobile)',
          y: 740,
        }),
        structuralLine({
          column: 'left',
          text: 'stephan.agerman@slvventure.',
          y: 720,
        }),
        structuralLine({ column: 'left', text: 'com', y: 700 }),
        structuralLine({
          column: 'left',
          text: 'www.linkedin.com/in/stephan-',
          y: 680,
        }),
        structuralLine({
          column: 'left',
          text: 'agerman (LinkedIn)',
          y: 660,
        }),
        structuralLine({ column: 'right', text: 'Summary', y: 640 }),
      ]
    );

    expect(result.value.contact.email).toBe('stephan.agerman@slvventure.com');
    expect(result.value.contact.phone).toBe('+1 310 498 3047');
    expect(result.value.contact.linkedin_url).toBe(
      'https://linkedin.com/in/stephan-agerman'
    );
  });

  test('keeps wrapped email fragments out of split contact link drafts', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      Principal Advisor

      Contact
      www.linkedin.com/in/stephan-
      stephan.agerman@slvventure.
      com
      agerman (LinkedIn)
    `);

    expect(result.value.contact.email).toBe('stephan.agerman@slvventure.com');
    expect(result.value.contact.linkedin_url).toBe(
      'https://linkedin.com/in/stephan-agerman'
    );
    expect(result.value.contact.links).toEqual([
      expect.objectContaining({
        label: 'LinkedIn',
        url: 'https://linkedin.com/in/stephan-agerman',
      }),
    ]);
  });

  test('falls back to header contact lines for empty structural contact sections', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Apollo Helios',
        'Principal Advisor',
        'apollo@example.com',
        'Contact',
        'Experience',
      ].join('\n'),
      [
        structuralLine({ column: 'right', text: 'Apollo Helios', y: 800 }),
        structuralLine({
          column: 'right',
          text: 'Principal Advisor',
          y: 780,
        }),
        structuralLine({
          column: 'right',
          text: 'apollo@example.com',
          y: 760,
        }),
        structuralLine({ column: 'left', text: 'Contact', y: 740 }),
        structuralLine({ column: 'right', text: 'Experience', y: 720 }),
      ]
    );

    expect(result.value.contact.email).toBe('apollo@example.com');
  });

  test('does not extract text contact email from summary sections', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Cassandra Troy
      Principal Advisor
      Los Angeles, California, United States

      Summary
      Cassandra can be reached at cassandra@example.com.

      Experience
      Example Labs
    `);

    expect(result.value.contact.email).toBeUndefined();
    expect(result.value.summary).toBe(
      'Cassandra can be reached at cassandra@example.com.'
    );
  });

  test('keeps adjacent contact links separate and allows colon continuations', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      apollo@example.com

      Contact
      www.linkedin.com/in/example
      portfolio.example.com
      docs.example.com/api/
      v1:alpha (Other)
    `);

    expect(result.value.contact.links).toEqual([
      expect.objectContaining({
        url: 'https://linkedin.com/in/example',
      }),
      expect.objectContaining({
        url: 'https://portfolio.example.com',
      }),
      expect.objectContaining({
        label: 'Other',
        url: 'https://docs.example.com/api/v1:alpha',
      }),
    ]);
  });

  test('extracts mobile phone contact lines with country code labels', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      ['Contact', '+1 720-520-5329 (Mobile)'].join('\n'),
      [
        structuralLine({ column: 'left', text: 'Contact', y: 760 }),
        structuralLine({
          column: 'left',
          text: '+1 720-520-5329 (Mobile)',
          y: 740,
        }),
      ]
    );

    expect(result.value.contact.phone).toBe('+1 720-520-5329');
  });

  test('extracts compact and international phone contact lines', () => {
    const compactPhone = BasicInfoParser.parse(`
      Apollo Helios
      Advisor

      Contact
      +1(415)988 8877 (Work)
    `);
    const internationalPhone = BasicInfoParser.parse(`
      Apollo Helios
      Advisor

      Contact
      +971 (55) 693-40-33 (Mobile)
    `);

    expect(compactPhone.contact.phone).toBe('+1(415)988 8877');
    expect(internationalPhone.contact.phone).toBe('+971 (55) 693-40-33');
  });

  test('extracts eight digit local phone numbers', () => {
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      Product Advisor

      Contact
      8765 4321
    `);

    expect(profile.contact.phone).toBe('8765 4321');
  });

  test('rejects whitespace-padded year ranges as phone search lines', () => {
    expect(BasicInfoParser['isPhoneSearchLine'](' 2017 - 2018 ')).toBe(false);
    expect(BasicInfoParser['isPhoneSearchLine'](' (2017 - present) ')).toBe(
      false
    );
    expect(BasicInfoParser['isPhoneSearchLine'](' 8765 4321 ')).toBe(true);
    expect(
      BasicInfoParser['isPhoneSearchLine'](
        '                8765 4321                 '
      )
    ).toBe(true);
  });

  test('uses the multiline engineering manager headline fallback', () => {
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      Engineering Manager @ Acme |
      Platform Reliability
    `);

    expect(profile.headline).toBe(
      'Engineering Manager @ Acme | Platform Reliability'
    );
  });

  test('builds a fallback summary from long identity lines', () => {
    const profile = BasicInfoParser.parse(`
      Apollo Helios
      Principal Advisor
      Toronto, Ontario, Canada
      Portfolio Focus
      Advisory Practice
      Builds reliable product and engineering systems for teams that need repeatable delivery across multiple business units.
      Partners with operations leaders to remove delivery risk and improve maintainability across the platform.
    `);

    expect(profile.summary).toBe(
      'Builds reliable product and engineering systems for teams that need repeatable delivery across multiple business units.'
    );
  });

  test('does not use text fallback summary parsing for structural PDFs without a summary section', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Apollo Helios',
        'Principal Advisor',
        'Toronto, Ontario, Canada',
        'Experience',
        'Example Labs',
        'Strategic Advisor',
        'March 2026 - Present (3 months)',
        'Example Labs builds reliable product and engineering systems for teams that need repeatable delivery across multiple business units.',
      ].join('\n'),
      [
        structuralLine({ column: 'right', text: 'Apollo Helios', y: 760 }),
        structuralLine({ column: 'right', text: 'Principal Advisor', y: 740 }),
        structuralLine({
          column: 'right',
          text: 'Toronto, Ontario, Canada',
          y: 720,
        }),
        structuralLine({ column: 'right', text: 'Experience', y: 690 }),
        structuralLine({ column: 'right', text: 'Example Labs', y: 670 }),
        structuralLine({
          column: 'right',
          text: 'Strategic Advisor',
          y: 650,
        }),
        structuralLine({
          column: 'right',
          text: 'March 2026 - Present (3 months)',
          y: 630,
        }),
        structuralLine({
          column: 'right',
          text: 'Example Labs builds reliable product and engineering systems for teams that need repeatable delivery across multiple business units.',
          y: 610,
        }),
      ]
    );

    expect(result.value.summary).toBeUndefined();
  });

  test('preserves structural summary length consistently with fallback summary parsing', () => {
    const longSummaryLine = `Builds ${'reliable systems '.repeat(40)}`.trim();
    const result = BasicInfoParser.parseStructuralWithWarnings(
      ['Apollo Helios', 'Principal Advisor', 'Summary', longSummaryLine].join(
        '\n'
      ),
      [
        structuralLine({ column: 'right', text: 'Summary', y: 700 }),
        structuralLine({ column: 'right', text: longSummaryLine, y: 690 }),
      ]
    );

    expect(result.value.summary).toBe(longSummaryLine);
  });

  test('covers contact link finalization, normalization, joining, and dedupe branches', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      Principal Advisor

      Contact
      docs.example.com
      api
      https://portfolio.example.com
      docs.example.com
      /api
      ?view=full
      #section
      docs.example.com/path-
      continued (Other)
      docs.example.com
    `);

    expect(result.value.contact.links).toEqual([
      expect.objectContaining({
        url: 'https://docs.example.com/api',
      }),
      expect.objectContaining({
        url: 'https://portfolio.example.com',
      }),
      expect.objectContaining({
        url: 'https://docs.example.com/api?view=full#section',
      }),
      expect.objectContaining({
        label: 'Other',
        url: 'https://docs.example.com/path-continued',
      }),
      expect.objectContaining({
        url: 'https://docs.example.com',
      }),
    ]);
  });

  test('ignores invalid contact link drafts and empty structural summary sections', () => {
    const links: NonNullable<
      ReturnType<typeof BasicInfoParser.parse>['contact']['links']
    > = [];

    BasicInfoParser['pushContactLink'](links, {
      parts: ['not-a-link'],
      rawLines: ['not-a-link'],
    });

    expect(links).toEqual([]);
    expect(
      BasicInfoParser['extractStructuralSummary']([
        structuralLine({ column: 'right', text: 'Summary', y: 700 }),
        structuralLine({ column: 'right', text: 'Experience', y: 690 }),
      ])
    ).toBeUndefined();
  });

  test('deduplicates repeated contact links', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Apollo Helios
      Principal Advisor

      Contact
      docs.example.com
      docs.example.com
    `);

    expect(result.value.contact.links).toEqual([
      expect.objectContaining({
        url: 'https://docs.example.com',
      }),
    ]);
  });
});

function structuralLine({
  column,
  text,
  y,
}: {
  column: StructuralLine['column'];
  text: string;
  y: number;
}): StructuralLine {
  return {
    column,
    fontSize: 10,
    height: 10,
    text,
    width: text.length * 5,
    x: column === 'left' ? 20 : 220,
    y,
  };
}
