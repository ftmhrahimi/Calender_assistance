/**
 * Options page controller: loads/saves config from chrome.storage.local
 * and runs connectivity tests through the background service worker.
 */

import { getConfig, setConfig, DEFAULTS } from '../lib/config.js';

const $ = (id) => document.getElementById(id);

const ui = {
  apiKey: $('api-key'),
  toggleKey: $('toggle-key'),
  model: $('model'),
  calendarId: $('calendar-id'),
  duration: $('duration'),
  timezone: $('timezone'),
  debug: $('debug'),
  save: $('save'),
  saveResult: $('save-result'),
  testApi: $('test-api'),
  apiTestResult: $('api-test-result'),
  testGoogle: $('test-google'),
  googleTestResult: $('google-test-result'),
  detectedTz: $('detected-tz')
};

function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || 'Unexpected error.'));
        return;
      }
      resolve(response.data);
    });
  });
}

function setResult(el, text, ok) {
  el.textContent = text;
  el.className = `test-result ${ok ? 'ok' : 'err'}`;
}

async function load() {
  const cfg = await getConfig();
  ui.apiKey.value = cfg.deepinfraApiKey;
  ui.model.value = cfg.model;
  ui.calendarId.value = cfg.calendarId;
  ui.duration.value = cfg.defaultDurationMinutes;
  ui.timezone.value = cfg.timeZone;
  ui.debug.checked = cfg.debugLogging;
  try {
    ui.detectedTz.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    ui.detectedTz.textContent = 'UTC';
  }
}

function validate() {
  const duration = Number(ui.duration.value);
  if (!Number.isFinite(duration) || duration < 5 || duration > 1440) {
    throw new Error('Default duration must be between 5 and 1440 minutes.');
  }
  const tz = ui.timezone.value.trim();
  if (tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      throw new Error(`"${tz}" is not a valid IANA time zone (e.g. Asia/Tehran).`);
    }
  }
  return {
    deepinfraApiKey: ui.apiKey.value.trim(),
    model: ui.model.value.trim() || DEFAULTS.model,
    calendarId: ui.calendarId.value.trim() || DEFAULTS.calendarId,
    defaultDurationMinutes: duration,
    timeZone: tz,
    debugLogging: ui.debug.checked
  };
}

async function onSave() {
  ui.save.disabled = true;
  try {
    const patch = validate();
    await setConfig(patch);
    setResult(ui.saveResult, 'Saved.', true);
  } catch (err) {
    setResult(ui.saveResult, err.message, false);
  } finally {
    ui.save.disabled = false;
    setTimeout(() => {
      ui.saveResult.textContent = '';
    }, 4000);
  }
}

async function onTestApi() {
  ui.testApi.disabled = true;
  setResult(ui.apiTestResult, 'Testing…', true);
  try {
    await send({
      type: 'TEST_API_KEY',
      apiKey: ui.apiKey.value.trim(),
      model: ui.model.value.trim() || DEFAULTS.model
    });
    setResult(ui.apiTestResult, '✓ API key works.', true);
  } catch (err) {
    setResult(ui.apiTestResult, err.message, false);
  } finally {
    ui.testApi.disabled = false;
  }
}

async function onTestGoogle() {
  ui.testGoogle.disabled = true;
  setResult(ui.googleTestResult, 'Opening Google sign-in…', true);
  try {
    const { calendarSummary } = await send({ type: 'TEST_GOOGLE_AUTH' });
    setResult(ui.googleTestResult, `✓ Connected to calendar "${calendarSummary}".`, true);
  } catch (err) {
    setResult(ui.googleTestResult, err.message, false);
  } finally {
    ui.testGoogle.disabled = false;
  }
}

ui.save.addEventListener('click', onSave);
ui.testApi.addEventListener('click', onTestApi);
ui.testGoogle.addEventListener('click', onTestGoogle);
ui.toggleKey.addEventListener('click', () => {
  const hidden = ui.apiKey.type === 'password';
  ui.apiKey.type = hidden ? 'text' : 'password';
  ui.toggleKey.textContent = hidden ? 'Hide' : 'Show';
});

load();
