export type LinkedInProfileParseErrorCode =
  | 'encrypted_pdf'
  | 'invalid_pdf'
  | 'not_linkedin_profile'
  | 'schema_validation_failed'
  | 'text_extraction_failed'
  | 'unsupported_pdf';

interface LinkedInProfileParseErrorParams {
  cause?: unknown;
  code: LinkedInProfileParseErrorCode;
  message?: string;
}

interface CreateLinkedInProfileParseErrorParams {
  cause?: unknown;
  code: LinkedInProfileParseErrorCode;
  message?: string;
}

const DEFAULT_ERROR_MESSAGES: Record<LinkedInProfileParseErrorCode, string> = {
  encrypted_pdf: 'PDF is encrypted and cannot be parsed without a password',
  invalid_pdf: 'PDF appears to be invalid or unreadable',
  not_linkedin_profile: 'Input does not look like a LinkedIn profile export',
  schema_validation_failed: 'Parsed profile result failed schema validation',
  text_extraction_failed: 'PDF appears to be empty or unreadable',
  unsupported_pdf: 'PDF uses unsupported features and cannot be parsed',
};
const TEXT_EXTRACTION_FAILED_MESSAGE = 'Input text could not be parsed';

export class LinkedInProfileParseError extends Error {
  readonly code: LinkedInProfileParseErrorCode;
  override readonly cause?: unknown;

  constructor({
    cause,
    code,
    message = DEFAULT_ERROR_MESSAGES[code],
  }: LinkedInProfileParseErrorParams) {
    super(message, { cause });
    this.name = 'LinkedInProfileParseError';
    this.code = code;
    this.cause = cause;
  }
}

export function createLinkedInProfileParseError({
  cause,
  code,
  message,
}: CreateLinkedInProfileParseErrorParams): LinkedInProfileParseError {
  return new LinkedInProfileParseError({
    cause,
    code,
    message,
  });
}

export function normalizeLinkedInProfileParseError({
  cause,
  inputKind,
}: {
  cause: unknown;
  inputKind: 'pdf' | 'text';
}): LinkedInProfileParseError {
  if (cause instanceof LinkedInProfileParseError) {
    return cause;
  }

  if (inputKind === 'pdf') {
    return createLinkedInProfileParseError({
      cause,
      code: classifyPdfErrorCode(cause),
    });
  }

  return createLinkedInProfileParseError({
    cause,
    code: 'text_extraction_failed',
    message: TEXT_EXTRACTION_FAILED_MESSAGE,
  });
}

function classifyPdfErrorCode(cause: unknown): LinkedInProfileParseErrorCode {
  const errorText = formatUnknownError(cause).toLowerCase();

  if (
    errorText.includes('password') ||
    errorText.includes('encrypted') ||
    errorText.includes('needspassword')
  ) {
    return 'encrypted_pdf';
  }

  if (
    errorText.includes('unsupported') ||
    errorText.includes('not implemented')
  ) {
    return 'unsupported_pdf';
  }

  return 'invalid_pdf';
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`;
  }

  return String(error);
}
