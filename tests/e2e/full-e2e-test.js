import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseLinkedInPDF } from '../../dist/index.js';
import { expectedTestResumeProfile } from '../fixtures/expected-test-resume-profile.js';

function valuesMatch(actual, expected) {
  return isDeepStrictEqual(actual, expected);
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

    console.log('\n📋 Test 2: Library Parsing');
    const result = await parseLinkedInPDF(pdfBuffer, { includeRawText: true });
    console.log(`✅ Parsed profile data for: ${result.profile.name}`);

    console.log('\n📋 Test 3: Strict Fixture Validation');
    const checks = [
      [
        'Raw text length',
        result.rawText?.length,
        expectedTestResumeProfile.rawTextLength,
      ],
      [
        'Raw text includes name',
        result.rawText?.includes(expectedTestResumeProfile.name),
        true,
      ],
      [
        'Raw text includes education',
        result.rawText?.includes('Universidade Veiga de Almeida'),
        true,
      ],
      ['Parsed name', result.profile.name, expectedTestResumeProfile.name],
      [
        'Parsed headline',
        result.profile.headline,
        expectedTestResumeProfile.headline,
      ],
      [
        'Parsed location',
        result.profile.location,
        expectedTestResumeProfile.location,
      ],
      ['Parsed email', result.profile.contact.email, undefined],
      [
        'Parsed LinkedIn URL',
        result.profile.contact.linkedin_url,
        expectedTestResumeProfile.contact.linkedin_url,
      ],
      [
        'Parsed top skills',
        result.profile.top_skills,
        expectedTestResumeProfile.top_skills,
      ],
      [
        'Parsed summary',
        result.profile.summary,
        expectedTestResumeProfile.summary,
      ],
      [
        'Parsed languages',
        result.profile.languages,
        expectedTestResumeProfile.languages,
      ],
      [
        'Parsed experience count',
        result.profile.experience.length,
        expectedTestResumeProfile.experienceLength,
      ],
      [
        'Parsed education count',
        result.profile.education.length,
        expectedTestResumeProfile.educationLength,
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
