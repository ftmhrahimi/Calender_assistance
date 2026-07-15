# 📅 Calendar Assistance

**AI-powered natural-language Google Calendar assistant** — type an event request in plain language (with full support for Persian/Jalali dates) and it appears in your Google Calendar.

> *"Meeting with Sara at the office next Monday at 3pm"* → ✅ event created in Google Calendar.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Demo Workflow](#demo-workflow)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Google API Credentials Setup](#google-api-credentials-setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Example Usage](#example-usage)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Future Improvements](#future-improvements)
- [Documentation](#documentation)
- [License](#license)

---

## Project Overview

Calendar Assistance bridges the gap between how people *describe* events and how calendar software *stores* them. Instead of filling out forms, the user types a single sentence. A large language model (Llama 2 70B, hosted on [DeepInfra](https://deepinfra.com/)) extracts the structured fields — title, location, start/end time — and the app inserts the event into the user's primary Google Calendar via the official Calendar API.

A distinguishing feature is **dual-calendar awareness**: the prompt is seeded with both today's Gregorian date and today's Persian (Jalali) date, so requests like *"جلسه ۲۸ شهریور ساعت ۱۰"* or *"meeting on 28th Shahrivar"* are converted to the correct Gregorian date for the current year.

## Features

- 🗣️ **Natural-language input** — no forms, just type your request.
- 🇮🇷 **Persian (Jalali) calendar support** — Jalali dates are converted to Gregorian automatically, correctly for the current year.
- 🕐 **Relative date resolution** — "tomorrow", "next Monday", etc.
- ⏱️ **Smart defaults** — 1-hour duration assumed when only a start time is given.
- 🔐 **Google OAuth 2.0** — secure browser-based login with automatic token caching and refresh.
- 📆 **Direct Google Calendar insertion** — event link printed on success.
- 🌐 **Optional HTTP interface** — a FastAPI wrapper (`main.py`) for exposing the pipeline as a REST endpoint.

## Demo Workflow

```text
==========================================================
  📅  Calendar Assistance  —  v1.0.0
  AI-powered natural-language Google Calendar events
==========================================================

📝 Type your request: Lunch with Ali at Cafe Naderi tomorrow at 1pm

✅ Event created: https://www.google.com/calendar/event?eid=...
```

Behind the scenes:

1. Your sentence is sent to the LLM with today's Gregorian + Jalali dates.
2. The LLM returns a structured dictionary (summary, location, start, end…).
3. The app builds a Google Calendar event body (time zone: `Asia/Tehran`).
4. You authenticate with Google (first run only — afterwards the token is cached).
5. The event is inserted and its link is printed.

## Project Structure

```text
Calender_assistance/
├── Combinev_org.py            # Core application: CLI, LLM extraction, Google Calendar
├── main.py                    # Optional FastAPI HTTP wrapper (POST /insert)
├── requirements.txt           # Python dependencies
├── .env.example               # Template for environment variables
├── .gitignore                 # Excludes secrets, tokens, venvs, caches
├── Makefile                   # Convenience commands (install, run, clean)
├── LICENSE                    # MIT license
├── README.md                  # This file
├── TECHNICAL_DOCUMENTATION.md # Architecture & internals
├── API_FLOW.md                # Step-by-step request lifecycle
├── DEVELOPER_GUIDE.md         # Guide for contributors/developers
├── USER_GUIDE.md              # Guide for non-technical users
├── CONTRIBUTING.md            # Contribution guidelines
├── CHANGELOG.md               # Release history
├── CODE_REVIEW.md             # Known improvement opportunities (not yet applied)
├── credentials.json           # (you provide — NOT committed) Google OAuth client secrets
└── token.json                 # (auto-generated — NOT committed) cached OAuth token
```

## Installation

### Prerequisites

- Python **3.9+**
- A Google account
- A DeepInfra account (for the LLM API token)

### Virtual Environment Setup

```bash
# Clone the repository
git clone https://github.com/ftmhrahimi/calender_assistance.git
cd calender_assistance

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Linux / macOS
# .venv\Scripts\activate         # Windows
```

### Dependencies

```bash
pip install -r requirements.txt
```

| Package | Why it exists |
|---|---|
| `langchain` | Provides `LLMChain`, the pipeline that binds the prompt to the model. |
| `langchain-community` | Provides the `DeepInfra` LLM integration (community-maintained connectors). |
| `langchain-core` | Provides `PromptTemplate` and core LangChain abstractions. |
| `persiantools` | Provides `JalaliDate` — today's date in the Persian calendar, injected into the prompt. |
| `google-api-python-client` | Official client for calling the Google Calendar API (`events.insert`). |
| `google-auth` | Core Google credential objects and token refresh (`Credentials`, `Request`). |
| `google-auth-oauthlib` | The browser-based OAuth 2.0 consent flow (`InstalledAppFlow`). |
| `fastapi` | Web framework for the optional HTTP interface in `main.py`. |
| `uvicorn` | ASGI server used to run the FastAPI app. |

## Google API Credentials Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create (or select) a project.
2. Enable the **Google Calendar API** (*APIs & Services → Library*).
3. Configure the **OAuth consent screen** (External is fine for personal use; add yourself as a test user).
4. Create credentials: *APIs & Services → Credentials → Create Credentials → OAuth client ID → **Desktop app***.
5. Download the JSON file and save it in the project root as **`credentials.json`**.
6. On first run, a browser window opens asking you to sign in and grant calendar access. A `token.json` file is then created automatically so you won't be asked again.

> ⚠️ **Never commit `credentials.json` or `token.json`** — both are excluded by `.gitignore`.

## Environment Variables

See [`.env.example`](.env.example) for the template.

| Variable | Description |
|---|---|
| `DEEPINFRA_API_TOKEN` | API token for the DeepInfra-hosted LLM. Get one at [deepinfra.com](https://deepinfra.com/). |

> **Note:** the app reads the token from the `DEEPINFRA_API_TOKEN` environment variable at runtime — it is no longer stored in the source. Export it (`export DEEPINFRA_API_TOKEN=your-token`) or copy [`.env.example`](.env.example) to `.env` and fill in your own value. The app exits with a clear message if the variable is unset.

## Running the Application

### Interactive CLI (primary mode)

```bash
python Combinev_org.py
```

### HTTP API (optional)

`main.py` exposes the pipeline as a REST endpoint:

```bash
uvicorn main:app --reload
# then:
curl -X POST http://127.0.0.1:8000/insert \
     -H "Content-Type: application/json" \
     -d '"Team standup tomorrow at 9am"'
```

> **Note:** `main.py` imports `Combinev4` and `new_version1`, module variants that are not included in this repository snapshot. Only the CLI (`Combinev_org.py`) is runnable as-is; see [CODE_REVIEW.md](CODE_REVIEW.md).

## Example Usage

### Sample Input

```text
📝 Type your request: Doctor appointment at Tehran Clinic on 28 Shahrivar at 10:30
```

### What the LLM extracts (intermediate)

```python
{
    "summary": "Doctor appointment",
    "location": "Tehran Clinic",
    "description": "not provided",
    "start": "2026-09-19T10:30:00+00:00",
    "end": "2026-09-19T11:30:00+00:00",
    "attendees": "not provided"
}
```

### Sample Output

```text
✅ Event created: https://www.google.com/calendar/event?eid=a1b2c3...
```

## Error Handling

| Situation | Behavior |
|---|---|
| LLM response contains no parseable dictionary | `ValueError: Failed to extract dictionary from LLM response` — caught by `main()` and reported as `❌ An unexpected error occurred: …` |
| Google Calendar API rejects the request | `HttpError` caught in `create_google_calendar_event()`, printed as `❌ An error occurred: …` |
| Expired OAuth token with a valid refresh token | Refreshed silently — no user action needed |
| Missing/invalid token | Browser OAuth consent flow is launched automatically |
| Any other failure (network, auth, parsing) | Caught by the top-level `try/except` in `main()` and printed; the program exits gracefully |

## Troubleshooting

| Problem | Fix |
|---|---|
| `FileNotFoundError: credentials.json` | Complete the [Google API credentials setup](#google-api-credentials-setup) and place `credentials.json` in the project root. |
| Browser doesn't open for login | Copy the URL printed in the terminal into a browser manually. |
| `invalid_grant` / token errors | Delete `token.json` and run again to re-authenticate. |
| `Access blocked: … has not completed the Google verification process` | Add your Google account as a **test user** on the OAuth consent screen. |
| `❌ An unexpected error occurred: Failed to extract dictionary…` | The LLM returned an unparseable answer. Re-run and phrase the request more explicitly (include a clear date and time). |
| Wrong event date/time | LLM date conversion is probabilistic — verify the event in Google Calendar, especially for Jalali dates. |
| `ModuleNotFoundError` | Ensure the virtual environment is activated and `pip install -r requirements.txt` completed. |

## Limitations

- Requires an internet connection (LLM + Google APIs are both remote).
- Event times use a fixed `Asia/Tehran` time zone.
- Attendees are extracted by the LLM but not yet added to the calendar event.
- One event per run — the CLI processes a single request and exits.
- LLM output is probabilistic; unusual phrasings can produce parsing failures or incorrect dates.
- The FastAPI wrapper depends on module variants not included in this repository.

## Future Improvements

- Add attendee support to the created event.
- Interactive loop (create multiple events per session).
- Configurable time zone and calendar selection.
- Structured/JSON-mode LLM output for robust parsing.
- Unit tests and CI pipeline.
- Load secrets from environment variables / `.env`.

## Documentation

| Document | Audience |
|---|---|
| [USER_GUIDE.md](USER_GUIDE.md) | Non-technical users — installation to first event |
| [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) | Engineers — architecture, flows, diagrams |
| [API_FLOW.md](API_FLOW.md) | Engineers — step-by-step request lifecycle |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Contributors — debugging, conventions, extension points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributors — how to submit changes |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Maintainers — known improvement opportunities |
| [CHANGELOG.md](CHANGELOG.md) | Everyone — release history |

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
