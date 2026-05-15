#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseLinkedInPDF } from './dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, 'Profile.pdf');
const strict = process.argv.includes('--strict');

const expected = {
  name: 'Harold Martin',
  headline: 'CTO @ SVRN',
  location: 'Los Angeles, California, United States',
  email: 'harold.martin@gmail.com',
  linkedin: 'https://linkedin.com/in/harold-martin-98526971',
  skills: ['Python', 'Amazon Web Services (AWS)', 'ElasticSearch'],
  firstExperience: {
    company: 'SVRN',
    title: 'Chief Technology Officer',
    duration: 'November 2025 - Present',
  },
};

function formatValue(value) {
  if (value === undefined) {
    return '<undefined>';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

function printCheck(label, actual, expectedValue, passed) {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`${status} ${label}`);
  console.log(`  actual:   ${formatValue(actual)}`);
  console.log(`  expected: ${formatValue(expectedValue)}`);
}

if (!fs.existsSync(fixturePath)) {
  console.error(`Profile fixture not found: ${fixturePath}`);
  process.exit(1);
}

const result = await parseLinkedInPDF(fs.readFileSync(fixturePath), {
  includeRawText: true,
});

const { profile } = result;
const firstExperience = profile.experience[0] ?? {};
const checks = [
  ['name', profile.name, expected.name, profile.name === expected.name],
  [
    'headline',
    profile.headline,
    expected.headline,
    profile.headline === expected.headline,
  ],
  [
    'location',
    profile.location,
    expected.location,
    profile.location === expected.location,
  ],
  [
    'email',
    profile.contact.email,
    expected.email,
    profile.contact.email === expected.email,
  ],
  [
    'linkedin',
    profile.contact.linkedin_url,
    expected.linkedin,
    profile.contact.linkedin_url === expected.linkedin,
  ],
  [
    'phone',
    profile.contact.phone,
    undefined,
    profile.contact.phone === undefined,
  ],
  [
    'skills',
    profile.top_skills,
    expected.skills,
    JSON.stringify(profile.top_skills) === JSON.stringify(expected.skills),
  ],
  [
    'first experience',
    firstExperience,
    expected.firstExperience,
    Object.entries(expected.firstExperience).every(
      ([key, value]) => firstExperience[key] === value
    ),
  ],
];

console.log(`Profile.pdf demo: ${fixturePath}`);
console.log(`Raw text length: ${result.rawText?.length ?? 0}`);
console.log(`Experience entries: ${profile.experience.length}`);
console.log(`Education entries: ${profile.education.length}`);
console.log('');

let failures = 0;
for (const [label, actual, expectedValue, passed] of checks) {
  if (!passed) {
    failures += 1;
  }
  printCheck(label, actual, expectedValue, passed);
}

console.log('');
console.log(`${checks.length - failures}/${checks.length} checks matched`);

if (strict && failures > 0) {
  process.exit(1);
}
