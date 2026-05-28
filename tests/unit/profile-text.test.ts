import {
  isLikelyLocationText,
  looksLikeOrganizationNameText,
  looksLikePositionTitleText,
} from '../../src/utils/profile-text.js';

describe('profile text heuristics', () => {
  test('matches position keywords as whole words only', () => {
    expect(looksLikePositionTitleText('Lead Engineer')).toBe(true);
    expect(looksLikePositionTitleText('Producer, SHARK WRANGLERS')).toBe(true);
    expect(looksLikePositionTitleText('2022 Youth Fellow')).toBe(true);
    expect(looksLikePositionTitleText('Contributing Writer')).toBe(true);
    expect(looksLikePositionTitleText('Managing Partner')).toBe(true);
    expect(looksLikePositionTitleText('Mentor')).toBe(true);
    expect(looksLikePositionTitleText('Business & Technology Executive')).toBe(
      true
    );
    expect(looksLikePositionTitleText('Sr. Programmer / Project Lead')).toBe(
      true
    );
    expect(looksLikePositionTitleText('International Bank')).toBe(false);
    expect(looksLikeOrganizationNameText('International Bank')).toBe(true);
  });

  test('matches position keywords across hyphen and punctuation boundaries', () => {
    expect(looksLikePositionTitleText('Co-Founder')).toBe(true);
    expect(looksLikePositionTitleText('Co Founder')).toBe(true);
    expect(looksLikePositionTitleText('Software-Engineer')).toBe(true);
    expect(looksLikePositionTitleText('Engineer, Platform')).toBe(true);
    expect(looksLikePositionTitleText('Staff (ENGINEER)')).toBe(true);
  });

  test('rejects position keywords embedded inside larger words', () => {
    expect(looksLikePositionTitleText('Engineership')).toBe(false);
    expect(looksLikePositionTitleText('Preengineer')).toBe(false);
    expect(looksLikePositionTitleText('Software Engineering')).toBe(false);
  });

  test('keeps dotted position titles from looking like organizations', () => {
    expect(looksLikePositionTitleText('Manager.')).toBe(true);
    expect(looksLikeOrganizationNameText('Manager.')).toBe(false);
    expect(looksLikePositionTitleText('I was responsible for hiring.')).toBe(
      false
    );
    expect(looksLikePositionTitleText('manager.')).toBe(false);
    expect(looksLikeOrganizationNameText('manager.')).toBe(false);
    expect(looksLikePositionTitleText('Engineering Manager • Led')).toBe(false);
    expect(looksLikeOrganizationNameText('Engineering Manager • Led')).toBe(
      false
    );
    expect(looksLikePositionTitleText('Engineering Manager...')).toBe(false);
    expect(looksLikeOrganizationNameText('Engineering Manager...')).toBe(false);
    expect(looksLikePositionTitleText('Engineering Manager…')).toBe(false);
    expect(looksLikeOrganizationNameText('Engineering Manager…')).toBe(false);
    expect(
      looksLikePositionTitleText(
        'Executive Produced by Achilles Pelides & Circe Aeaea'
      )
    ).toBe(false);
  });

  test('accepts only one allowlisted trailing title parenthetical', () => {
    expect(looksLikePositionTitleText('Lead Engineer (Contractor)')).toBe(true);
    expect(looksLikePositionTitleText('Lead Engineer (R&D)')).toBe(false);
    expect(looksLikePositionTitleText('Lead Engineer (R&D) (Contractor)')).toBe(
      false
    );
  });

  test('supports accented organization words without promoting locations', () => {
    expect(looksLikeOrganizationNameText('Ação Labs')).toBe(true);
    expect(looksLikeOrganizationNameText('Ampli & Co')).toBe(true);
    expect(looksLikeOrganizationNameText('Fulldome Film Society')).toBe(true);
    expect(looksLikeOrganizationNameText('Stage Venture Partners')).toBe(true);
    expect(looksLikeOrganizationNameText('São Paulo Tech')).toBe(true);
    expect(looksLikeOrganizationNameText('Remote')).toBe(false);
  });

  test('does not mistake organization suffixes for locations', () => {
    expect(looksLikeOrganizationNameText('Google, LLC')).toBe(true);
    expect(looksLikeOrganizationNameText('Google, Inc')).toBe(true);
    expect(looksLikeOrganizationNameText('Los Angeles, California')).toBe(
      false
    );
    expect(
      looksLikeOrganizationNameText('Los Angeles, California, United States')
    ).toBe(false);
  });

  test('recognizes Bay Area profile locations', () => {
    expect(isLikelyLocationText('San Francisco Bay Area')).toBe(true);
  });

  test('recognizes country-only and greater area profile locations', () => {
    expect(isLikelyLocationText('United States')).toBe(true);
    expect(isLikelyLocationText('Greater Minneapolis-St. Paul Area')).toBe(
      true
    );
  });

  test('recognizes comma-separated locations with 3-letter country codes', () => {
    expect(isLikelyLocationText('San Francisco, CA, USA')).toBe(true);
    expect(isLikelyLocationText('Toronto, ON, CAN')).toBe(true);
  });
});
