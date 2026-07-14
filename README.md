# Calendar Assistant — Chrome Extension

Create Google Calendar events from natural language, in **English or Persian (Farsi)** — including **Jalali (Persian calendar) dates** — powered by an LLM hosted on [DeepInfra](https://deepinfra.com).

> "جلسه با علی پنج‌شنبه ساعت ۱۰ صبح" → a real event on your Google Calendar, Thursday at 10:00.

## How it works

1. Click the extension icon and describe your event in plain language.
2. The extension sends your request (plus today's Gregorian *and* Jalali dates) to a DeepInfra-hosted model, which extracts a structured event: title, date/time, location, description, attendees. Relative dates ("tomorrow", "فردا") and Jalali dates are resolved to real Gregorian dates.
3. You review and edit the parsed event in a preview form.
4. One click inserts it into your Google Calendar via Google's official API, authenticated with your own Google account through Chrome's built-in identity flow.

## Features

- English and Persian input, with Jalali → Gregorian date conversion validated against a tested conversion library (`extension/lib/jalali.js`).
- Editable preview before anything touches your calendar — the AI never writes events unreviewed.
- Attendees, location, description, configurable default duration, target calendar, and time zone.
- Manifest V3, minimal permissions (`identity`, `storage`, and only the two API hosts it talks to).
- No server component: your browser talks directly to DeepInfra and Google.
- No bundled secrets: you bring your own DeepInfra API key (stored only in `chrome.storage.local`) and your own Google OAuth client ID.

## Quick start

1. **Get the code**: clone this repository.
2. **Load the extension**: `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select the `extension/` folder.
3. **Configure Google OAuth**: create a Google Cloud OAuth client for the extension and put its client ID in `extension/manifest.json` — full walkthrough in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
4. **Add your DeepInfra API key**: the options page opens automatically on install; paste your key and press *Test API key*, then *Save*.
5. Click the toolbar icon and create your first event.

## Documentation

- **[Deployment Guide](docs/DEPLOYMENT.md)** — prerequisites, Google/DeepInfra setup, building, packaging, installing, Web Store publishing, troubleshooting.
- **[Technical Guide](docs/TECHNICAL.md)** — architecture, folder structure, data flow, token management, error handling, security, and how to extend the project.

## Development

```bash
npm test          # unit tests (date conversion, LLM output parsing/validation)
npm run test:smoke  # loads the extension in headless Chromium and exercises the UI
npm run package   # builds dist/calendar-assistant-<version>.zip
npm run icons     # regenerates extension icons
```

There is no build/transpile step: the extension is plain ES modules and loads unpacked directly from `extension/`.

## Security notes

- The DeepInfra API key is entered by the user, kept in `chrome.storage.local`, and sent only to `api.deepinfra.com`. It is never committed to the repository.
- Google access uses `chrome.identity.getAuthToken` with the narrow `calendar.events` scope; Chrome manages the tokens, the extension never stores them.
- ⚠️ **Historical note**: an early prototype in this repository's git history contained a hardcoded DeepInfra API token. That token must be treated as compromised — if it was yours, revoke it in the [DeepInfra dashboard](https://deepinfra.com/dash/api_keys).
