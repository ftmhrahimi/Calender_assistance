/**
 * Google Calendar integration.
 *
 * Authentication uses chrome.identity.getAuthToken with the OAuth client ID
 * declared in manifest.json ("oauth2" section). Tokens are managed entirely
 * by Chrome; the extension never stores Google credentials itself.
 */

import { AppError, ERROR_CODES } from './errors.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/** Promisified chrome.identity.getAuthToken, normalizing the return shape. */
export function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      if (chrome.runtime.lastError) {
        reject(
          new AppError(
            ERROR_CODES.AUTH_FAILED,
            `Google sign-in failed: ${chrome.runtime.lastError.message}`
          )
        );
        return;
      }
      // Older Chrome passes the token string; newer passes { token, grantedScopes }.
      const token = typeof result === 'string' ? result : result?.token;
      if (!token) {
        reject(new AppError(ERROR_CODES.AUTH_FAILED, 'Google did not return an access token.'));
        return;
      }
      resolve(token);
    });
  });
}

function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

/**
 * Build the Calendar API event resource from a normalized event.
 * dateTime values are wall-clock local times; the explicit timeZone field
 * tells Google how to interpret them (per RFC3339 requirement waiver in
 * the Calendar API when timeZone is set).
 */
export function buildEventResource(event, timeZone) {
  const resource = {
    summary: event.summary,
    start: { dateTime: event.start, timeZone },
    end: { dateTime: event.end, timeZone }
  };
  if (event.location) resource.location = event.location;
  if (event.description) resource.description = event.description;
  if (event.attendees?.length) {
    resource.attendees = event.attendees.map((email) => ({ email }));
  }
  return resource;
}

async function calendarFetch(path, token, init = {}) {
  let response;
  try {
    response = await fetch(`${CALENDAR_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });
  } catch {
    throw new AppError(ERROR_CODES.NETWORK, 'Could not reach Google Calendar. Check your internet connection.');
  }
  return response;
}

async function calendarErrorFrom(response) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || '';
  } catch {
    /* non-JSON error body */
  }
  return new AppError(
    ERROR_CODES.CALENDAR_ERROR,
    `Google Calendar request failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`
  );
}

/**
 * Insert an event into the user's calendar. Retries once with a fresh
 * token if Google rejects the cached one (401).
 *
 * @returns {{id: string, htmlLink: string}}
 */
export async function insertEvent(resource, calendarId = 'primary') {
  let token = await getAuthToken(true);
  const path = `/calendars/${encodeURIComponent(calendarId)}/events`;
  const init = { method: 'POST', body: JSON.stringify(resource) };

  let response = await calendarFetch(path, token, init);
  if (response.status === 401) {
    await removeCachedToken(token);
    token = await getAuthToken(true);
    response = await calendarFetch(path, token, init);
  }
  if (!response.ok) {
    throw await calendarErrorFrom(response);
  }
  const created = await response.json();
  return { id: created.id, htmlLink: created.htmlLink };
}

/**
 * Verify Google authorization works by fetching the target calendar's
 * metadata. Used by the options page "Sign in" button.
 */
export async function testGoogleAuth(calendarId = 'primary') {
  let token = await getAuthToken(true);
  const path = `/calendars/${encodeURIComponent(calendarId)}`;
  let response = await calendarFetch(path, token);
  if (response.status === 401) {
    await removeCachedToken(token);
    token = await getAuthToken(true);
    response = await calendarFetch(path, token);
  }
  if (!response.ok) {
    throw await calendarErrorFrom(response);
  }
  const calendar = await response.json();
  return { calendarSummary: calendar.summary || calendarId };
}
