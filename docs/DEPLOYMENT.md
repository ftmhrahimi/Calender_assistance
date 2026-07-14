# Deployment Guide

This guide takes you from a fresh clone to a working, installable Chrome extension, and then to production distribution.

## 1. Prerequisites

| Requirement | Why | Notes |
|---|---|---|
| Google Chrome 116+ (or Chromium/Edge with `chrome.identity`) | Runs the extension | Manifest V3 with module service worker |
| A Google account | The calendar the events go into | Any Gmail / Workspace account |
| A Google Cloud project | Issues the OAuth client ID for Calendar access | Free |
| A DeepInfra account + API key | Runs the language model that parses requests | Pay-per-token; get a key at <https://deepinfra.com/dash/api_keys> |
| Node.js 18+ (optional) | Only for running tests and the packaging script | Not needed just to install the extension |
| Python 3 (optional) | Only for regenerating icons | Not needed just to install the extension |

There is **no build step**: the extension in `extension/` is plain ES modules and is loaded as-is.

## 2. Environment setup

```bash
git clone https://github.com/ftmhrahimi/Calender_assistance.git
cd Calender_assistance
npm install        # optional: dev dependencies for tests only
npm test           # optional: verify the toolchain
```

## 3. Install the extension in Chrome (development / unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder of this repository.
4. Note the **ID** shown on the extension card (a 32-letter string). You need it in the next step.

The options page opens automatically on first install.

## 4. Google OAuth client (required for Calendar access)

The manifest ships with a placeholder client ID. Google sign-in will fail until you replace it with your own. OAuth client IDs are public identifiers, not secrets — committing yours to your fork is safe and normal.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create (or pick) a project.
2. **Enable the API**: *APIs & Services → Library → Google Calendar API → Enable*.
3. **Configure the consent screen**: *APIs & Services → OAuth consent screen*.
   - User type: *External* (or *Internal* for a Workspace org).
   - Add the scope `https://www.googleapis.com/auth/calendar.events`.
   - While the app is in *Testing* status, add each user's Google account under **Test users**.
4. **Create the OAuth client**: *APIs & Services → Credentials → Create credentials → OAuth client ID*.
   - Application type: **Chrome extension**.
   - Item ID: the extension ID from step 3.4 above.
5. Copy the generated client ID (ends in `.apps.googleusercontent.com`) into `extension/manifest.json`:

   ```json
   "oauth2": {
     "client_id": "1234567890-abcdef.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/calendar.events"]
   }
   ```

6. Back on `chrome://extensions`, press the **reload** icon on the extension card.

### Keeping the extension ID stable

The OAuth client is bound to the extension ID, so the ID must not change:

- **Unpacked**: the ID is derived from the folder's absolute path — it stays stable as long as you load from the same path. Team setups should add a `"key"` field to the manifest so everyone gets the same ID: pack the extension once (`chrome://extensions → Pack extension`), or take the `key` value Chrome stores for an installed extension, and commit it.
- **Chrome Web Store**: the store assigns a permanent ID at first upload. Create the OAuth client with *that* ID for the published version.

## 5. API token configuration (DeepInfra)

The DeepInfra key is configured at runtime, never in code:

1. Create a key at <https://deepinfra.com/dash/api_keys>.
2. Open the extension's options page (toolbar icon → ⚙, or `chrome://extensions` → Details → Extension options).
3. Paste the key, click **Test API key** (runs a one-token completion against the configured model), then **Save settings**.
4. Optionally adjust the model, default event duration, target calendar ID, and time zone.

The key is stored in `chrome.storage.local` for this browser profile only and is sent exclusively to `https://api.deepinfra.com`.

## 6. Verify the installation

1. Options page → **Test API key** → expect “✓ API key works.”
2. Options page → **Sign in & test Google access** → a Google consent window opens; approve it → expect “✓ Connected to calendar …”.
3. Toolbar icon → type *"Team standup tomorrow at 9:30 for 15 minutes"* → **Preview event** → check the parsed fields → **Add to Google Calendar** → follow the “Open in Google Calendar” link.
4. Try a Persian request, e.g. *"جلسه با سارا پنج‌شنبه ساعت ۱۴"*.

## 7. Build & packaging

To produce a distributable ZIP (for the Chrome Web Store or manual sharing):

```bash
npm run package
# -> dist/calendar-assistant-<version>.zip
```

The script warns if the manifest still contains the placeholder OAuth client ID.

Before packaging a release: bump `"version"` in `extension/manifest.json`, run `npm test`, and run `npm run test:smoke` if a Chromium binary is available.

## 8. Production deployment (Chrome Web Store)

1. Register as a [Chrome Web Store developer](https://chrome.google.com/webstore/devconsole) (one-time $5 fee).
2. Upload `dist/calendar-assistant-<version>.zip` as a new item. Note the **item ID** the store assigns.
3. Create a **new** Google OAuth client of type *Chrome extension* bound to the store item ID (section 4), put it in the manifest, and upload a new package version.
4. Fill in the store listing (screenshots, description, privacy policy). In the privacy section, declare:
   - `identity` — Google sign-in for Calendar access;
   - `storage` — saving user settings;
   - host access to `googleapis.com` (Calendar API) and `api.deepinfra.com` (AI parsing).
5. For public release, move the OAuth consent screen out of *Testing* into *Production* (Google verifies apps using sensitive scopes like `calendar.events`; expect a review).
6. Submit for review. Users install from the store and only need to add their own DeepInfra key in options.

For a private/team rollout instead, use the Web Store's *unlisted* visibility or a Workspace [private publishing](https://support.google.com/chrome/a/answer/2663860) policy — the OAuth steps are identical.

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| “Custom URI scheme is not supported” / `bad client id` during Google sign-in | Placeholder or wrong OAuth client ID, or client bound to a different extension ID | Recheck section 4; the client ID in the manifest must belong to a *Chrome extension* OAuth client whose item ID equals your extension's current ID |
| “Google sign-in failed: OAuth2 not granted or revoked” | User closed the consent window, or app is in *Testing* and the account isn't a test user | Retry and approve; add the account under *Test users* on the consent screen |
| “Access blocked: this app has not completed Google's verification” | Consent screen in Testing/unverified for a sensitive scope | Add the user as a test user, or complete Google's app verification for production |
| “DeepInfra rejected the API key” | Key typo, revoked key, or exhausted credit | Re-paste the key and use **Test API key**; check the DeepInfra dashboard |
| “DeepInfra request failed (HTTP 404 …)” | Model ID no longer offered by DeepInfra | Pick a current chat model ID in options (see the datalist suggestions) |
| Parsed date is wrong for a Persian request | Smaller models convert Jalali dates less reliably | Use a 70B-class model; always check the preview before saving |
| Event appears at the wrong hour | Time zone mismatch | Set your IANA time zone explicitly in options (e.g. `Asia/Tehran`); the popup footer shows which zone is applied |
| “Google Calendar request failed (HTTP 404)” | Wrong calendar ID in options | Use `primary` or copy the exact calendar ID from Google Calendar → calendar settings |
| Extension card shows “Service worker (inactive)” | Normal MV3 behavior — the worker sleeps when idle | Nothing to fix; it wakes on demand |
| Changes to code don't take effect | Chrome caches the loaded extension | Press the reload icon on `chrome://extensions` |

**Where to look for logs**: `chrome://extensions` → the extension card → *Inspect views: service worker* (enable *Enable debug logging* in options for verbose output). Popup/options pages: right-click → *Inspect*.
