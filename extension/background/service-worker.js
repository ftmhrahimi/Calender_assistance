/**
 * Background service worker: single owner of all network calls.
 *
 * The popup and options pages talk to it via chrome.runtime.sendMessage
 * with { type, ...payload } and receive { ok, data } or { ok, error, code }.
 * Keeping network work here means an in-flight "create event" call survives
 * the popup closing.
 */

import { getConfig, resolveTimeZone } from '../lib/config.js';
import { parseRequest, testApiKey } from '../lib/llm.js';
import { buildEventResource, insertEvent, testGoogleAuth } from '../lib/calendar.js';
import { AppError, ERROR_CODES } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

let debugEnabled = false;
const log = createLogger('background', () => debugEnabled);

async function refreshDebugFlag() {
  const cfg = await getConfig();
  debugEnabled = Boolean(cfg.debugLogging);
  return cfg;
}

async function handleMessage(message) {
  const cfg = await refreshDebugFlag();
  const timeZone = resolveTimeZone(cfg);

  switch (message?.type) {
    case 'GET_STATUS': {
      return {
        hasApiKey: Boolean(cfg.deepinfraApiKey),
        model: cfg.model,
        timeZone,
        calendarId: cfg.calendarId
      };
    }
    case 'PARSE_REQUEST': {
      log.debug('Parsing request', message.text);
      const event = await parseRequest(message.text, cfg, timeZone);
      log.debug('Parsed event', event);
      return { event, timeZone };
    }
    case 'CREATE_EVENT': {
      const resource = buildEventResource(message.event, timeZone);
      log.debug('Inserting event', resource);
      const created = await insertEvent(resource, cfg.calendarId);
      log.debug('Created event', created);
      return created;
    }
    case 'TEST_API_KEY': {
      // Allows testing a key that is typed but not yet saved.
      const testCfg = message.apiKey
        ? { ...cfg, deepinfraApiKey: message.apiKey, model: message.model || cfg.model }
        : cfg;
      await testApiKey(testCfg);
      return { valid: true };
    }
    case 'TEST_GOOGLE_AUTH': {
      return testGoogleAuth(cfg.calendarId);
    }
    default:
      throw new AppError(ERROR_CODES.UNKNOWN, `Unknown message type: ${message?.type}`);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => {
      log.error('Request failed', message?.type, err);
      sendResponse({
        ok: false,
        code: err instanceof AppError ? err.code : ERROR_CODES.UNKNOWN,
        error: err?.message || 'Unexpected error.'
      });
    });
  // Keep the message channel open for the async response.
  return true;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // First install: send the user to options to configure the API key.
    chrome.runtime.openOptionsPage();
  }
});
