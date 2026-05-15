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
});
