import { jest } from '@jest/globals';
import { z } from 'zod';
import {
  LinkedInProfileParseError,
  ParseResultSchema,
  parseLinkedInPDF,
  parseLinkedInPDFStrict,
  safeParseLinkedInPDF,
} from '../../src/index.js';
import { normalizeLinkedInProfileParseError } from '../../src/errors.js';
import { StructuralParser } from '../../src/parsers/structural-parser.js';

describe('public parser diagnostics and typed errors', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns diagnostics for a full LinkedIn-like profile', async () => {
    const result = await parseLinkedInPDF(`
      Orion Helios
      Principal Engineer
      San Francisco, CA
      https://linkedin.com/in/orion-helios

      Summary
      Builds reliable parsing systems for professional profile exports.

      Experience
      Principal Engineer at Fixture Co
      January 2020 - Present

      Education
      BS Computer Science
      Example University

      Top Skills
      TypeScript
      Parsing
    `);

    expect(result.diagnostics.sectionsFound).toEqual([
      'summary',
      'experience',
      'education',
      'top_skills',
    ]);
    expect(result.diagnostics.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.diagnostics.isLikelyLinkedInExport).toBe(true);
    expect(result.diagnostics.isEmpty).toBe(false);
  });

  test('distinguishes sparse LinkedIn-like input from random readable text', async () => {
    const sparseResult = await parseLinkedInPDF(`
      Sparse Candidate
      sparse@example.com
      LinkedIn
      Available on request for additional professional details.
    `);
    const randomResult = await parseLinkedInPDF(`
      Quarterly memo
      Revenue changed
      Expenses changed
      The appendix contains totals
      Nothing here is a profile
      End of report
    `);

    expect(sparseResult.diagnostics.isLikelyLinkedInExport).toBe(true);
    expect(sparseResult.diagnostics.isEmpty).toBe(false);
    expect(randomResult.diagnostics.isLikelyLinkedInExport).toBe(false);
    expect(randomResult.diagnostics.isEmpty).toBe(true);
    expect(randomResult.diagnostics.confidence).toBe(0);
  });

  test('throws typed errors for empty text input', async () => {
    await expect(parseLinkedInPDF('')).rejects.toMatchObject({
      code: 'text_extraction_failed',
    });
    await expect(parseLinkedInPDF('')).rejects.toBeInstanceOf(
      LinkedInProfileParseError
    );
  });

  test('throws typed errors for invalid PDF input', async () => {
    await expect(parseLinkedInPDF(Buffer.alloc(0))).rejects.toMatchObject({
      code: 'invalid_pdf',
    });
    await expect(parseLinkedInPDF(Buffer.alloc(0))).rejects.toBeInstanceOf(
      LinkedInProfileParseError
    );
  });

  test('classifies encrypted PDF extraction failures', async () => {
    jest
      .spyOn(StructuralParser, 'extractStructuredText')
      .mockRejectedValue(new Error('PasswordException: No password given'));

    await expect(parseLinkedInPDF(new Uint8Array([1, 2, 3]))).rejects.toEqual(
      expect.objectContaining({
        code: 'encrypted_pdf',
      })
    );
  });

  test('classifies unsupported PDF extraction failures', async () => {
    jest
      .spyOn(StructuralParser, 'extractStructuredText')
      .mockRejectedValue(new Error('Unsupported PDF feature'));

    await expect(parseLinkedInPDF(new Uint8Array([1, 2, 3]))).rejects.toEqual(
      expect.objectContaining({
        code: 'unsupported_pdf',
      })
    );
  });

  test('normalizes unknown text parser failures as typed errors', () => {
    expect(
      normalizeLinkedInProfileParseError({
        cause: 'plain text failure',
        inputKind: 'text',
      })
    ).toEqual(
      expect.objectContaining({
        cause: 'plain text failure',
        code: 'text_extraction_failed',
      })
    );
  });

  test('strict parser validates the parse result schema', async () => {
    const schemaError = new z.ZodError([]);

    jest.spyOn(ParseResultSchema, 'safeParse').mockReturnValue({
      error: schemaError,
      success: false,
    });

    await expect(
      parseLinkedInPDFStrict(`
        Orion Helios
        orion@example.com
        LinkedIn
        Available on request for additional professional details.
      `)
    ).rejects.toMatchObject({
      cause: schemaError,
      code: 'schema_validation_failed',
    });
  });

  test('strict parser returns schema-valid results on success', async () => {
    const result = await parseLinkedInPDFStrict(`
      Orion Helios
      orion@example.com
      LinkedIn
      Available on request for additional professional details.
    `);

    expect(result.profile.name).toBe('Orion Helios');
    expect(result.diagnostics.isLikelyLinkedInExport).toBe(true);
  });

  test('safe parser returns typed failure results', async () => {
    const result = await safeParseLinkedInPDF('short');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBeInstanceOf(LinkedInProfileParseError);
      expect(result.error.code).toBe('text_extraction_failed');
    }
  });
});
