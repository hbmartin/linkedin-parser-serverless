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
  | 'experience'
  | 'education';

export const PROFILE_SECTION_HEADER_ENTRIES: ReadonlyArray<
  readonly [text: string, section: ProfileSectionKey]
> = [
  ['contact', 'contact'],
  ['contact info', 'contact'],
  ['kontakt', 'contact'],
  ['summary', 'summary'],
  ['top skills', 'top_skills'],
  ['skills', 'top_skills'],
  ['competencias', 'top_skills'],
  ['competências', 'top_skills'],
  ['habilidades', 'top_skills'],
  ['languages', 'languages'],
  ['idiomas', 'languages'],
  ['berufserfahrung', 'experience'],
  ['experience', 'experience'],
  ['experiencia', 'experience'],
  ['experiência', 'experience'],
  ['education', 'education'],
  ['formacao', 'education'],
  ['formação', 'education'],
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
  ['volunteer experience', 'volunteer_work'],
  ['volunteer work', 'volunteer_work'],
  ['volunteering', 'volunteer_work'],
  ['experiencia voluntaria', 'volunteer_work'],
  ['experiência voluntária', 'volunteer_work'],
];
