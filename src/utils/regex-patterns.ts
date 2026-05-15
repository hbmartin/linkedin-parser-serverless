export const REGEX_PATTERNS = {
  EMAIL: /[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}/g,
  LINKEDIN: /linkedin\.com\/in\/([\w-]+)/i,
  PHONE: /(\+\d{1,3}\s?)?(\(?\d{2,3}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/,
  PAGE_NUMBERS: /Page \d+ of \d+/gi,
  TOP_SKILLS:
    /(?:^|\n)[^\S\r\n]*Top Skills[^\S\r\n]*\n([\s\S]*?)(?=\n[^\S\r\n]*(?:Languages|Certifications|Licenses\s+&\s+Certifications|Projects|Volunteer(?:\s+(?:Experience|Work))?|Summary|Experience|Education)[^\S\r\n]*(?:\n|$)|$)/i,
  LANGUAGES:
    /(?:^|\n)[^\S\r\n]*Languages[^\S\r\n]*\n([\s\S]*?)(?=\n[^\S\r\n]*(?:Certifications|Licenses\s+&\s+Certifications|Projects|Volunteer(?:\s+(?:Experience|Work))?|Summary|Experience|Education)[^\S\r\n]*(?:\n|$)|$)/i,
  SUMMARY:
    /Summary\s+([\s\S]+?)(?:Certifications|Licenses\s+&\s+Certifications|Projects|Volunteer(?:\s+(?:Experience|Work))?|Experience|Education|$)/i,
  EXPERIENCE:
    /Experience\s+([\s\S]+?)(?:Certifications|Licenses\s+&\s+Certifications|Projects|Volunteer(?:\s+(?:Experience|Work))?|Education|$)/i,
  EDUCATION:
    /Education\s+([\s\S]+?)(?:Certifications|Licenses\s+&\s+Certifications|Projects|Volunteer(?:\s+(?:Experience|Work))?|$)/i,
  NAME: /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*/m,
  LOCATION: /([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:,\s*[A-Z]{2,})?)/,
  LANGUAGE_PROFICIENCY: /(Native|Professional|Elementary|Limited)/i,
  DATE_RANGE: /(\w+\s+\d{4})\s*[-–]\s*(\w+\s+\d{4}|Present)/i,
  YEAR: /\b(19|20)\d{2}\b/g,
  LINE_BREAK: /\r?\n/g,
  MULTIPLE_SPACES: /\s{2,}/g,
  BULLET_POINTS: /^[\u2022•]\s*/gm,
} as const;
