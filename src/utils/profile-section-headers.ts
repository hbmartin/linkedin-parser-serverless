export type ProfileSectionKey =
  | 'contact'
  | 'summary'
  | 'top_skills'
  | 'languages'
  | 'certifications'
  | 'honors_awards'
  | 'volunteer_work'
  | 'projects'
  | 'publications'
  | 'patents'
  | 'organizations'
  | 'experience'
  | 'education';

interface ProfileSectionHeaderAliasGroup {
  section: ProfileSectionKey;
  texts: readonly string[];
}

type ProfileSectionHeaderEntry = readonly [
  text: string,
  section: ProfileSectionKey,
];

const PROFILE_SECTION_HEADER_ALIAS_GROUPS: readonly ProfileSectionHeaderAliasGroup[] =
  [
    {
      section: 'contact',
      texts: [
        'contact',
        'contact info',
        'contatta',
        'contatti',
        'coordonnees',
        'coordonnées',
        'forbindelse',
        'kontakt',
      ],
    },
    {
      section: 'summary',
      texts: ['summary', 'resume', 'résumé', 'riepilogo'],
    },
    {
      section: 'top_skills',
      texts: [
        'top skills',
        'skills',
        'competencias',
        'competências',
        'habilidades',
        'competenze principali',
        'principales competences',
        'principales compétences',
      ],
    },
    {
      section: 'languages',
      texts: ['languages', 'idiomas'],
    },
    {
      section: 'experience',
      texts: [
        'berufserfahrung',
        'erfaring',
        'experience',
        'experiencia',
        'experiência',
        'esperienza',
        'expérience',
      ],
    },
    {
      section: 'education',
      texts: [
        'education',
        'formacao',
        'formação',
        'formazione',
        'formation',
        'utdanning',
      ],
    },
    {
      section: 'certifications',
      texts: [
        'certifications',
        'licenses and certifications',
        'licences and certifications',
        'certificacoes',
        'certificações',
        'certificacoes e licencas',
        'certificações e licenças',
      ],
    },
    {
      section: 'honors_awards',
      texts: [
        'honors awards',
        'honors and awards',
        'honours awards',
        'honours and awards',
      ],
    },
    {
      section: 'projects',
      texts: ['projects', 'projetos'],
    },
    {
      section: 'publications',
      texts: ['publications'],
    },
    {
      section: 'patents',
      texts: ['patents', 'patent'],
    },
    {
      section: 'organizations',
      texts: ['organizations', 'organisations', 'memberships', 'membership'],
    },
    {
      section: 'volunteer_work',
      texts: [
        'volunteer experience',
        'volunteer work',
        'volunteering',
        'experiencia voluntaria',
        'experiência voluntária',
      ],
    },
  ];

export const PROFILE_SECTION_HEADER_ENTRIES: ReadonlyArray<ProfileSectionHeaderEntry> =
  PROFILE_SECTION_HEADER_ALIAS_GROUPS.flatMap(group =>
    group.texts.map((text): ProfileSectionHeaderEntry => [text, group.section])
  );
