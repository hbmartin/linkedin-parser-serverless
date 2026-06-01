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

export const PROFILE_SECTION_HEADER_ENTRIES: ReadonlyArray<
  readonly [text: string, section: ProfileSectionKey]
> = [
  ['contact', 'contact'],
  ['contact info', 'contact'],
  ['contatti', 'contact'],
  ['coordonnees', 'contact'],
  ['coordonnées', 'contact'],
  ['forbindelse', 'contact'],
  ['kontakt', 'contact'],
  ['summary', 'summary'],
  ['resume', 'summary'],
  ['résumé', 'summary'],
  ['riepilogo', 'summary'],
  ['top skills', 'top_skills'],
  ['skills', 'top_skills'],
  ['competencias', 'top_skills'],
  ['competências', 'top_skills'],
  ['habilidades', 'top_skills'],
  ['competenze principali', 'top_skills'],
  ['principales competences', 'top_skills'],
  ['principales compétences', 'top_skills'],
  ['languages', 'languages'],
  ['idiomas', 'languages'],
  ['berufserfahrung', 'experience'],
  ['erfaring', 'experience'],
  ['experience', 'experience'],
  ['experiencia', 'experience'],
  ['experiência', 'experience'],
  ['esperienza', 'experience'],
  ['expérience', 'experience'],
  ['education', 'education'],
  ['formacao', 'education'],
  ['formação', 'education'],
  ['formazione', 'education'],
  ['formation', 'education'],
  ['utdanning', 'education'],
  ['certifications', 'certifications'],
  ['licenses and certifications', 'certifications'],
  ['licences and certifications', 'certifications'],
  ['certificacoes', 'certifications'],
  ['certificações', 'certifications'],
  ['certificacoes e licencas', 'certifications'],
  ['certificações e licenças', 'certifications'],
  ['honors awards', 'honors_awards'],
  ['honors and awards', 'honors_awards'],
  ['honours awards', 'honors_awards'],
  ['honours and awards', 'honors_awards'],
  ['projects', 'projects'],
  ['projetos', 'projects'],
  ['publications', 'publications'],
  ['patents', 'patents'],
  ['patent', 'patents'],
  ['organizations', 'organizations'],
  ['organisations', 'organizations'],
  ['memberships', 'organizations'],
  ['membership', 'organizations'],
  ['volunteer experience', 'volunteer_work'],
  ['volunteer work', 'volunteer_work'],
  ['volunteering', 'volunteer_work'],
  ['experiencia voluntaria', 'volunteer_work'],
  ['experiência voluntária', 'volunteer_work'],
];
