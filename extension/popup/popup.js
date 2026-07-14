/**
 * Popup UI controller. All network work happens in the background
 * service worker; this file only renders state and relays messages.
 */

const $ = (id) => document.getElementById(id);

const ui = {
  stepInput: $('step-input'),
  stepPreview: $('step-preview'),
  stepDone: $('step-done'),
  request: $('request'),
  parseBtn: $('parse-btn'),
  summary: $('ev-summary'),
  start: $('ev-start'),
  end: $('ev-end'),
  location: $('ev-location'),
  description: $('ev-description'),
  attendees: $('ev-attendees'),
  tzNote: $('tz-note'),
  backBtn: $('back-btn'),
  createBtn: $('create-btn'),
  newBtn: $('new-btn'),
  eventLink: $('event-link'),
  status: $('status'),
  error: $('error'),
  errorText: $('error-text'),
  errorOptionsBtn: $('error-options-btn'),
  openOptions: $('open-options')
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error('No response from the extension background worker.'));
        return;
      }
      if (!response.ok) {
        const err = new Error(response.error);
        err.code = response.code;
        reject(err);
        return;
      }
      resolve(response.data);
    });
  });
}

function showStep(step) {
  ui.stepInput.hidden = step !== 'input';
  ui.stepPreview.hidden = step !== 'preview';
  ui.stepDone.hidden = step !== 'done';
}

function setStatus(text) {
  ui.status.hidden = !text;
  ui.status.innerHTML = text ? `<span class="spinner"></span>${text}` : '';
}

function showError(err) {
  ui.error.hidden = false;
  ui.errorText.textContent = err.message || String(err);
  const needsOptions = err.code === 'NO_API_KEY' || err.code === 'INVALID_API_KEY';
  ui.errorOptionsBtn.hidden = !needsOptions;
}

function clearError() {
  ui.error.hidden = true;
  ui.errorText.textContent = '';
  ui.errorOptionsBtn.hidden = true;
}

/** "YYYY-MM-DDTHH:MM:SS" -> value for <input type="datetime-local"> */
function toInputValue(naive) {
  return naive.slice(0, 16);
}

/** <input type="datetime-local"> value -> "YYYY-MM-DDTHH:MM:SS" */
function fromInputValue(value) {
  return value.length === 16 ? `${value}:00` : value;
}

function collectEvent() {
  const summary = ui.summary.value.trim();
  const start = ui.start.value;
  const end = ui.end.value;
  if (!summary) throw new Error('The event needs a title.');
  if (!start) throw new Error('The event needs a start date and time.');
  if (!end) throw new Error('The event needs an end date and time.');
  if (end <= start) throw new Error('The end time must be after the start time.');

  const attendees = ui.attendees.value
    .split(/[,;\s]+/)
    .map((a) => a.trim())
    .filter(Boolean);
  const invalid = attendees.filter((a) => !EMAIL.test(a));
  if (invalid.length) {
    throw new Error(`Invalid attendee email: ${invalid[0]}`);
  }

  return {
    summary,
    location: ui.location.value.trim() || null,
    description: ui.description.value.trim() || null,
    start: fromInputValue(start),
    end: fromInputValue(end),
    attendees
  };
}

async function onParse() {
  clearError();
  const text = ui.request.value.trim();
  if (!text) {
    showError(new Error('Please describe the event you want to create.'));
    return;
  }
  ui.parseBtn.disabled = true;
  setStatus('Understanding your request…');
  try {
    const { event, timeZone } = await send({ type: 'PARSE_REQUEST', text });
    ui.summary.value = event.summary;
    ui.start.value = toInputValue(event.start);
    ui.end.value = toInputValue(event.end);
    ui.location.value = event.location || '';
    ui.description.value = event.description || '';
    ui.attendees.value = event.attendees.join(', ');
    ui.tzNote.textContent = `Times are in ${timeZone}.`;
    showStep('preview');
  } catch (err) {
    showError(err);
  } finally {
    ui.parseBtn.disabled = false;
    setStatus('');
  }
}

async function onCreate() {
  clearError();
  let event;
  try {
    event = collectEvent();
  } catch (err) {
    showError(err);
    return;
  }
  ui.createBtn.disabled = true;
  setStatus('Adding to Google Calendar…');
  try {
    const created = await send({ type: 'CREATE_EVENT', event });
    ui.eventLink.href = created.htmlLink;
    showStep('done');
  } catch (err) {
    showError(err);
  } finally {
    ui.createBtn.disabled = false;
    setStatus('');
  }
}

function reset() {
  clearError();
  ui.request.value = '';
  showStep('input');
  ui.request.focus();
}

ui.parseBtn.addEventListener('click', onParse);
ui.createBtn.addEventListener('click', onCreate);
ui.backBtn.addEventListener('click', () => {
  clearError();
  showStep('input');
});
ui.newBtn.addEventListener('click', reset);
ui.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
ui.errorOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
ui.request.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onParse();
});

// Surface missing configuration immediately instead of on first use.
send({ type: 'GET_STATUS' })
  .then((status) => {
    if (!status.hasApiKey) {
      showError(
        Object.assign(new Error('Set your DeepInfra API key in the extension settings to get started.'), {
          code: 'NO_API_KEY'
        })
      );
    }
  })
  .catch(() => {
    /* status check is best-effort */
  });

ui.request.focus();
