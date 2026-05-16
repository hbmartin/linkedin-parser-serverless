import type {
  Education,
  Experience,
  Language,
  LinkedInProfile,
  ParseWarning,
} from '../../src/index.js';

export interface ExpectedTestResumeProfile {
  name: string;
  headline: string;
  location: string;
  contact: LinkedInProfile['contact'];
  top_skills: string[];
  languages: Language[];
  summary: string;
  experienceLength: number;
  educationLength: number;
  firstExperience: Experience;
  cartaSeniorEngineerExperience: Experience;
  firstEducation: Education;
  warnings: ParseWarning[];
  rawTextLength: number;
}

export declare const expectedTestResumeProfile: ExpectedTestResumeProfile;
