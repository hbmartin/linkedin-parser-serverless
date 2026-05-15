import {
  looksLikeOrganizationNameText,
  looksLikePositionTitleText,
} from '../../src/utils/profile-text.js';

describe('profile text heuristics', () => {
  test('matches position keywords as whole words only', () => {
    expect(looksLikePositionTitleText('Lead Engineer')).toBe(true);
    expect(looksLikePositionTitleText('International Bank')).toBe(false);
    expect(looksLikeOrganizationNameText('International Bank')).toBe(true);
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
});
