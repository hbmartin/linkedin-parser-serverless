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
    expect(looksLikePositionTitleText('International Bank')).toBe(false);
    expect(looksLikeOrganizationNameText('International Bank')).toBe(true);
  });

  test('rejects sentence fragments that end with punctuation as titles', () => {
    expect(looksLikePositionTitleText('Manager.')).toBe(false);
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
});
