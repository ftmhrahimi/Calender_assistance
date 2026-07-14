/**
 * Error type carrying a machine-readable code so the UI can react
 * (e.g. NO_API_KEY opens the options page) while still showing a
 * human-readable message.
 */
export class AppError extends Error {
  /**
   * @param {string} code One of the ERROR_CODES values.
   * @param {string} message User-facing description.
   */
  constructor(code, message) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export const ERROR_CODES = {
  NO_API_KEY: 'NO_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMITED: 'RATE_LIMITED',
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
  LLM_BAD_OUTPUT: 'LLM_BAD_OUTPUT',
  VALIDATION: 'VALIDATION',
  AUTH_FAILED: 'AUTH_FAILED',
  CALENDAR_ERROR: 'CALENDAR_ERROR',
  NETWORK: 'NETWORK',
  UNKNOWN: 'UNKNOWN'
};
