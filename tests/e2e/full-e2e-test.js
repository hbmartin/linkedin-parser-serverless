import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { parseLinkedInPDF } from '../../dist/index.js';

const expectedProfile = {
  name: 'Arkady Zalkowitsch',
  headline:
    'Senior Engineering Manager @ Commure | ex-Carta | MBA in Business Management',
  location: 'Sunnyvale, California, United States',
  linkedinUrl: 'https://linkedin.com/in/arkadyzalko',
  topSkills: [
    'Strategic Roadmaps',
    'Electronic Engineering',
    'Project Planning',
  ],
  languages: [
    { language: 'Inglês  Working', proficiency: 'Professional' },
    { language: 'Espanhol', proficiency: 'Elementary' },
  ],
  experienceCount: 14,
  educationCount: 5,
  rawTextLength: 13078,
  pdfTextLength: 13184,
};

function valuesMatch(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

async function extractPdfText(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function runFullE2ETest() {
  console.log('🚀 Starting Full E2E Test for PDF Parser');
  console.log('='.repeat(50));

  try {
    console.log('\n📋 Test 1: Loading Test PDF');
    const testPdfPath = path.join(
      process.cwd(),
      'tests',
      'fixtures',
      'test_resume.pdf'
    );

    if (!fs.existsSync(testPdfPath)) {
      throw new Error(`Test PDF file not found at ${testPdfPath}`);
    }

    const pdfBuffer = fs.readFileSync(testPdfPath);
    console.log(
      `✅ Loaded test PDF: ${testPdfPath} (${pdfBuffer.length} bytes)`
    );

    console.log('\n📋 Test 2: Independent PDF Text Extraction');
    const text = await extractPdfText(pdfBuffer);
    console.log(`✅ Extracted ${text.length} characters of text`);

    console.log('\n📋 Test 3: Library Parsing');
    const result = await parseLinkedInPDF(pdfBuffer, { includeRawText: true });
    console.log(`✅ Parsed profile data for: ${result.profile.name}`);

    console.log('\n📋 Test 4: Strict Fixture Validation');
    const checks = [
      ['PDF text length', text.length, expectedProfile.pdfTextLength],
      ['PDF text includes name', text.includes(expectedProfile.name), true],
      [
        'PDF text includes education',
        text.includes('Universidade Veiga de Almeida'),
        true,
      ],
      ['Parsed name', result.profile.name, expectedProfile.name],
      ['Parsed headline', result.profile.headline, expectedProfile.headline],
      ['Parsed location', result.profile.location, expectedProfile.location],
      ['Parsed email', result.profile.contact.email, undefined],
      [
        'Parsed LinkedIn URL',
        result.profile.contact.linkedin_url,
        expectedProfile.linkedinUrl,
      ],
      [
        'Parsed top skills',
        result.profile.top_skills,
        expectedProfile.topSkills,
      ],
      ['Parsed languages', result.profile.languages, expectedProfile.languages],
      [
        'Parsed experience count',
        result.profile.experience.length,
        expectedProfile.experienceCount,
      ],
      [
        'Parsed education count',
        result.profile.education.length,
        expectedProfile.educationCount,
      ],
      [
        'Raw text length',
        result.rawText?.length,
        expectedProfile.rawTextLength,
      ],
    ];

    const failedChecks = checks.filter(
      ([, actual, expected]) => !valuesMatch(actual, expected)
    );

    for (const [name, actual, expected] of checks) {
      const passed = valuesMatch(actual, expected);
      console.log(
        `  ${passed ? '✅ PASS' : '❌ FAIL'} - ${name}: ${JSON.stringify(actual)}`
      );
    }

    console.log('\n📄 Final Parsed Summary:');
    console.log(
      JSON.stringify(
        {
          name: result.profile.name,
          contact: result.profile.contact,
          top_skills: result.profile.top_skills,
          languages: result.profile.languages,
          experienceCount: result.profile.experience.length,
          educationCount: result.profile.education.length,
          warningCount: result.warnings.length,
          rawTextLength: result.rawText?.length,
        },
        null,
        2
      )
    );

    if (failedChecks.length > 0) {
      throw new Error(`${failedChecks.length} strict validation checks failed`);
    }

    console.log('\n🎉 ALL TESTS PASSED!');
    return true;
  } catch (error) {
    console.error('\n❌ E2E Test Failed:');
    console.error(error);
    return false;
  }
}

runFullE2ETest().then(success => {
  process.exit(success ? 0 : 1);
});
