import { readFileSync } from 'node:fs';

const testResumeResult = JSON.parse(
  readFileSync(new URL('./test_resume.json', import.meta.url), 'utf8')
);
const { profile, warnings } = testResumeResult;
const cartaSeniorEngineerExperience = profile.experience.find(
  experience =>
    experience.company === 'Carta' &&
    experience.title === 'Senior Software Engineer'
);

if (!cartaSeniorEngineerExperience) {
  throw new Error('Expected Carta senior software engineer experience fixture');
}

export const expectedTestResumeProfile = Object.freeze({
  name: profile.name,
  headline: profile.headline,
  location: profile.location,
  contact: profile.contact,
  top_skills: profile.top_skills,
  languages: profile.languages,
  summary: profile.summary,
  experienceLength: profile.experience.length,
  educationLength: profile.education.length,
  firstExperience: profile.experience[0],
  cartaSeniorEngineerExperience,
  firstEducation: profile.education[0],
  warnings,
  rawTextLength: 13078,
});
