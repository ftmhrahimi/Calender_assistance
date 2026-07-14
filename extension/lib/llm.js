/**
 * Natural-language -> structured event parsing via the DeepInfra
 * OpenAI-compatible chat completions API.
 *
 * Everything except `parseRequest` is a pure function so the parsing and
 * validation logic can be unit-tested in Node without a Chrome runtime.
 */

import { toJalali, formatJalali } from './jalali.js';
import { AppError, ERROR_CODES } from './errors.js';

export const DEEPINFRA_CHAT_URL =
  'https://api.deepinfra.com/v1/openai/chat/completions';

const REQUEST_TIMEOUT_MS = 45000;
const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Today's date/time in the target time zone, in both calendars.
 * Injected into the prompt so the model can resolve relative and
 * Jalali dates correctly.
 */
export function buildDateContext(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hour12: false
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  // Intl may render midnight as "24" with hour12: false.
  const hour = get('hour') === '24' ? '00' : get('hour');

  const j = toJalali(year, month, day);
  const pad = (n) => String(n).padStart(2, '0');

  return {
    gregorianDate: `${year}-${pad(month)}-${pad(day)}`,
    jalaliDate: formatJalali(j.jy, j.jm, j.jd),
    weekday: get('weekday'),
    time: `${hour}:${get('minute')}`,
    timeZone
  };
}

/** Chat messages instructing the model to emit strict JSON. */
export function buildMessages(userRequest, ctx, defaultDurationMinutes) {
  const system = `You are a calendar event extraction engine.

Current date and time (time zone: ${ctx.timeZone}):
- Gregorian date: ${ctx.gregorianDate} (${ctx.weekday})
- Persian (Jalali) date: ${ctx.jalaliDate}
- Current time: ${ctx.time}

The user writes a scheduling request in English or Persian (Farsi). Extract the event details and reply with a single JSON object and NOTHING else - no prose, no markdown fences.

JSON schema:
{
  "summary": string,            // short event title; required
  "location": string | null,
  "description": string | null,
  "start": "YYYY-MM-DDTHH:MM:SS",  // wall-clock local time, NO time zone offset, NO 'Z'
  "end": "YYYY-MM-DDTHH:MM:SS" | null,
  "attendees": string[]         // email addresses only; [] if none
}

Rules:
1. Resolve relative dates ("tomorrow", "next Monday", "فردا", "پس‌فردا") against the current date above.
2. If the user gives a Persian (Jalali) date, convert it to Gregorian using the current Jalali year (${ctx.jalaliDate.slice(0, 4)}) unless another year is stated. Jalali-to-Gregorian mapping shifts between years, so anchor the conversion to today's dates shown above.
3. Keep the time exactly as the user said it; convert Persian digits (۱۲۳...) to Latin digits. Do not shift times between time zones.
4. If no start time is given, use 09:00:00.
5. If no end is given, set "end" to null (the application applies a default ${defaultDurationMinutes}-minute duration).
6. Use null for any missing optional field. Never invent locations, attendees, or descriptions.
7. Output must be valid JSON parseable by JSON.parse.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: userRequest }
  ];
}

/**
 * Extract the first balanced JSON object from model output.
 * Tolerates markdown fences and surrounding prose.
 */
export function extractEventJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new AppError(ERROR_CODES.LLM_BAD_OUTPUT, 'The model returned an empty response.');
  }
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  if (start === -1) {
    throw new AppError(ERROR_CODES.LLM_BAD_OUTPUT, 'No JSON object found in the model response.');
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          throw new AppError(
            ERROR_CODES.LLM_BAD_OUTPUT,
            'The model response contained malformed JSON.'
          );
        }
      }
    }
  }
  throw new AppError(ERROR_CODES.LLM_BAD_OUTPUT, 'The model response contained an unterminated JSON object.');
}

function cleanText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /^(null|none|not provided|n\/a)$/i.test(trimmed)) return null;
  return trimmed;
}

/** Parse "YYYY-MM-DDTHH:MM[:SS]" into numeric components, or null. */
function parseNaive(value) {
  if (typeof value !== 'string') return null;
  const m = NAIVE_DATETIME.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const c = {
    y: +y, mo: +mo, d: +d, h: +h, mi: +mi, s: s ? +s : 0
  };
  if (c.mo < 1 || c.mo > 12 || c.d < 1 || c.d > 31 || c.h > 23 || c.mi > 59 || c.s > 59) {
    return null;
  }
  return c;
}

function toUtcMillis(c) {
  return Date.UTC(c.y, c.mo - 1, c.d, c.h, c.mi, c.s);
}

function formatNaive(millis) {
  return new Date(millis).toISOString().slice(0, 19);
}

/**
 * Validate and normalize the raw model output into the event shape the
 * rest of the app uses. Throws AppError(VALIDATION | LLM_BAD_OUTPUT) on
 * unusable input.
 */
export function normalizeEvent(raw, { defaultDurationMinutes = 60 } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError(ERROR_CODES.LLM_BAD_OUTPUT, 'The model did not return an event object.');
  }

  const summary = cleanText(raw.summary);
  if (!summary) {
    throw new AppError(
      ERROR_CODES.VALIDATION,
      'Could not determine an event title from your request. Please rephrase and include what the event is.'
    );
  }

  const start = parseNaive(raw.start);
  if (!start) {
    throw new AppError(
      ERROR_CODES.VALIDATION,
      'Could not determine the event date and time. Please include when the event happens.'
    );
  }
  const startMs = toUtcMillis(start);

  let endMs;
  const end = parseNaive(raw.end);
  if (end) {
    endMs = toUtcMillis(end);
    if (endMs <= startMs) {
      endMs = startMs + defaultDurationMinutes * 60000;
    }
  } else {
    endMs = startMs + defaultDurationMinutes * 60000;
  }

  const attendees = Array.isArray(raw.attendees)
    ? raw.attendees
        .map((a) => (typeof a === 'string' ? a.trim() : ''))
        .filter((a) => EMAIL.test(a))
    : [];

  return {
    summary,
    location: cleanText(raw.location),
    description: cleanText(raw.description),
    start: formatNaive(startMs),
    end: formatNaive(endMs),
    attendees
  };
}

function messageForStatus(status, bodyText) {
  if (status === 401 || status === 403) {
    return new AppError(
      ERROR_CODES.INVALID_API_KEY,
      'DeepInfra rejected the API key. Check the key in the extension options.'
    );
  }
  if (status === 402) {
    return new AppError(
      ERROR_CODES.INVALID_API_KEY,
      'DeepInfra reports insufficient credit for this API key.'
    );
  }
  if (status === 429) {
    return new AppError(ERROR_CODES.RATE_LIMITED, 'DeepInfra rate limit reached. Try again in a moment.');
  }
  return new AppError(
    ERROR_CODES.LLM_UNAVAILABLE,
    `DeepInfra request failed (HTTP ${status})${bodyText ? `: ${bodyText.slice(0, 200)}` : ''}`
  );
}

/**
 * Full pipeline: prompt the model with the user's request and return a
 * normalized event object.
 *
 * @param {string} text User's natural-language request.
 * @param {object} cfg Resolved config (see config.js DEFAULTS).
 * @param {string} timeZone IANA time zone for date context.
 */
export async function parseRequest(text, cfg, timeZone, fetchImpl = fetch) {
  if (!cfg.deepinfraApiKey) {
    throw new AppError(
      ERROR_CODES.NO_API_KEY,
      'No DeepInfra API key configured. Add one in the extension options.'
    );
  }
  const trimmed = (text || '').trim();
  if (!trimmed) {
    throw new AppError(ERROR_CODES.VALIDATION, 'Please describe the event you want to create.');
  }

  const ctx = buildDateContext(timeZone);
  const messages = buildMessages(trimmed, ctx, cfg.defaultDurationMinutes);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(DEEPINFRA_CHAT_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.deepinfraApiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0,
        max_tokens: 600
      })
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new AppError(ERROR_CODES.NETWORK, 'The DeepInfra request timed out. Try again.');
    }
    throw new AppError(ERROR_CODES.NETWORK, 'Could not reach DeepInfra. Check your internet connection.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw messageForStatus(response.status, bodyText);
  }

  const payload = await response.json().catch(() => {
    throw new AppError(ERROR_CODES.LLM_BAD_OUTPUT, 'DeepInfra returned a non-JSON response.');
  });
  const content = payload?.choices?.[0]?.message?.content;
  const raw = extractEventJson(content);
  return normalizeEvent(raw, { defaultDurationMinutes: cfg.defaultDurationMinutes });
}

/**
 * Cheap connectivity/credential check used by the options page:
 * a one-token completion against the configured model.
 */
export async function testApiKey(cfg, fetchImpl = fetch) {
  if (!cfg.deepinfraApiKey) {
    throw new AppError(ERROR_CODES.NO_API_KEY, 'Enter an API key first.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetchImpl(DEEPINFRA_CHAT_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.deepinfraApiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      })
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new AppError(ERROR_CODES.NETWORK, 'The DeepInfra request timed out.');
    }
    throw new AppError(ERROR_CODES.NETWORK, 'Could not reach DeepInfra.');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw messageForStatus(response.status, bodyText);
  }
  return true;
}
