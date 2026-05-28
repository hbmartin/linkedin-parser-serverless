// E2E test to verify the library works end-to-end with unpdf
import fs from 'fs';
import { isDeepStrictEqual } from 'node:util';
import { parseLinkedInPDF } from '../../dist/index.js';
import { expectedTestResumeProfile } from '../fixtures/expected-test-resume-profile.js';

console.log('🚀 Running E2E Test with unpdf\n');

async function runE2ETest() {
  try {
    console.log('📂 Loading test PDF...');
    const pdfBuffer = fs.readFileSync(
      new URL('../fixtures/test_resume.pdf', import.meta.url)
    );
    console.log(`✅ PDF loaded: ${pdfBuffer.length} bytes`);

    console.log('\n🔍 Parsing PDF with library...');
    const startTime = Date.now();
    const result = await parseLinkedInPDF(pdfBuffer, { includeRawText: true });
    const endTime = Date.now();

    console.log(`✅ Parsing completed in ${endTime - startTime}ms`);

    console.log('\n📋 Extracted Profile:');
    console.log('📧 Email:', result.profile.contact.email);
    console.log('👤 Name:', result.profile.name);
    console.log('📍 Location:', result.profile.location);
    console.log('💼 Headline:', result.profile.headline);
    console.log('🎯 Skills:', result.profile.top_skills.slice(0, 3).join(', '));
    console.log(
      '🌐 Languages:',
      result.profile.languages
        .map(l => `${l.language} (${l.proficiency})`)
        .slice(0, 2)
        .join(', ')
    );
    console.log('💼 Experience items:', result.profile.experience.length);
    console.log('🎓 Education items:', result.profile.education.length);

    console.log('\n📄 Raw text info:');
    console.log('📝 Raw text length:', result.rawText?.length || 0);
    console.log(
      '📝 Raw text preview:',
      result.rawText?.substring(0, 200) || 'No raw text'
    );

    console.log('\n🔍 Validation checks:');
    const checks = {
      'Expected email absent': result.profile.contact.email === undefined,
      'Expected LinkedIn URL found':
        result.profile.contact.linkedin_url ===
        expectedTestResumeProfile.contact.linkedin_url,
      'Expected name found':
        result.profile.name === expectedTestResumeProfile.name,
      'Expected headline found':
        result.profile.headline === expectedTestResumeProfile.headline,
      'Expected location found':
        result.profile.location === expectedTestResumeProfile.location,
      'Expected skills found':
        isDeepStrictEqual(
          result.profile.top_skills,
          expectedTestResumeProfile.top_skills
        ),
      'Expected languages found':
        isDeepStrictEqual(
          result.profile.languages,
          expectedTestResumeProfile.languages
        ),
      'Expected summary found':
        result.profile.summary === expectedTestResumeProfile.summary,
      'Expected experience count':
        result.profile.experience.length ===
        expectedTestResumeProfile.experienceLength,
      'Expected education count':
        result.profile.education.length ===
        expectedTestResumeProfile.educationLength,
      'Expected raw text length':
        result.rawText?.length === expectedTestResumeProfile.rawTextLength,
      'Processing time reasonable': endTime - startTime < 5000,
    };

    let passedChecks = 0;
    const totalChecks = Object.keys(checks).length;

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}: ${passed}`);
      if (passed) {
        passedChecks++;
      }
    });

    console.log(
      `\n📊 Test Results: ${passedChecks}/${totalChecks} checks passed`
    );

    if (passedChecks === totalChecks) {
      console.log(
        '🎉 ALL TESTS PASSED! The library works perfectly with unpdf.'
      );
      return true;
    } else {
      console.log('⚠️ Some checks failed, but the library is functional.');
      return false;
    }
  } catch (error) {
    console.error('❌ E2E Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

runE2ETest()
  .then(success => {
    console.log(`\n🏁 E2E Test Result: ${success ? 'SUCCESS' : 'FAILED'}`);
    return process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
