/**
 * Extension configuration stored in chrome.storage.local.
 *
 * The DeepInfra API key is user-provided at runtime through the options page.
 * It never ships with the extension and never leaves the user's machine
 * except in Authorization headers to api.deepinfra.com.
 */

export const DEFAULTS = {
  deepinfraApiKey: '',
  model: 'meta-llama/Llama-3.3-70B-Instruct',
  // Empty string means "auto-detect from the browser".
  timeZone: '',
  defaultDurationMinutes: 60,
  calendarId: 'primary',
  debugLogging: false
};

/** Read the full config, falling back to defaults for unset keys. */
export async function getConfig() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

/** Persist a partial config patch. */
export async function setConfig(patch) {
  await chrome.storage.local.set(patch);
}

/** The IANA time zone to use for new events. */
export function resolveTimeZone(config) {
  if (config.timeZone) return config.timeZone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
