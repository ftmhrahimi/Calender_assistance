# User Guide — Calendar Assistance 📅

Welcome! This guide explains how to install and use Calendar Assistance **without any programming knowledge**. By the end, you'll be able to add events to your Google Calendar just by typing a sentence.

---

## What does it do?

You type something like:

> *Dentist appointment next Tuesday at 4pm at Pardis Clinic*

…and the event appears in your Google Calendar automatically. You can use everyday language, including **Persian (Jalali) dates** like *"28 Shahrivar"*.

## 1. Installation

You only do this once.

### Step 1 — Install Python

Download Python 3 from [python.org/downloads](https://www.python.org/downloads/) and install it. On Windows, tick **"Add Python to PATH"** during installation.

### Step 2 — Download the app

Download this project (green **Code → Download ZIP** button on GitHub) and unzip it, or ask a technical friend to clone it for you.

### Step 3 — Install the requirements

Open a terminal (Windows: press Start, type `cmd`; Mac: open *Terminal*), go to the project folder, and run:

```
cd path/to/calender_assistance
pip install -r requirements.txt
```

### Step 4 — Get your Google "key file"

The app needs permission to write to *your* calendar. This requires a one-time file called `credentials.json`:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and sign in with your Google account.
2. Create a new project (any name).
3. Search for **"Google Calendar API"** and click **Enable**.
4. Go to **APIs & Services → OAuth consent screen**, choose **External**, fill in the app name and your email, and add your own email as a **Test user**.
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID → Desktop app**.
6. Click the **download** icon next to the new credential, rename the file to `credentials.json`, and put it in the project folder.

> This sounds technical, but it's a one-time setup of about 10 minutes. If you get stuck, the [Troubleshooting](#4-common-errors) section below covers the usual snags.

## 2. Logging In (first run only)

The first time you run the app, a browser window will open asking you to:

1. Sign in to your Google account.
2. You may see a warning that the app is unverified — click **Advanced → Continue** (it's your own app).
3. Allow access to your calendar.

That's it. The app remembers you afterwards (it saves a small file called `token.json`), so you won't be asked again.

## 3. Running the App and Creating Events

In the terminal, from the project folder, run:

```
python Combinev_org.py
```

You'll see:

```
==========================================================
  📅  Calendar Assistance  —  v1.0.0
  AI-powered natural-language Google Calendar events
==========================================================

📝 Type your request:
```

Type your event and press **Enter**. Examples that work well:

- `Meeting with Sara tomorrow at 10am at the office`
- `Lunch with Ali on Friday at 1pm at Cafe Naderi`
- `Doctor appointment on 28 Shahrivar at 10:30 at Tehran Clinic`

After a few seconds you'll see:

```
✅ Event created: https://www.google.com/calendar/event?eid=...
```

Open Google Calendar (or click the link) — your event is there! To add another event, just run the app again.

**Tips for best results:**

- Always include a **date** (or "tomorrow" / a weekday) and a **time**.
- If you don't give an end time, the event lasts **1 hour**.
- Mention the place if you want a location on the event.

## 4. Common Errors

| What you see | What it means | What to do |
|---|---|---|
| `credentials.json` not found | The Google key file is missing | Complete Step 4 of Installation and make sure the file is in the project folder with exactly that name |
| "Access blocked" during login | Google doesn't know you're a test user | In Google Cloud Console, add your email as a **Test user** on the OAuth consent screen |
| `❌ An unexpected error occurred: Failed to extract dictionary…` | The AI didn't understand the request | Try again with clearer wording — include an explicit date and time |
| `❌ An error occurred: …` after login | Google Calendar rejected the event | Check your internet connection and try again |
| Login page keeps appearing | Your saved login expired | Delete the file `token.json` from the project folder and run the app again |
| `pip` or `python` "not recognized" | Python isn't installed correctly | Reinstall Python and tick "Add Python to PATH" |

## 5. FAQ

**Is my Google password stored anywhere?**
No. You sign in on Google's own website. The app only stores a permission token (`token.json`) on your computer — you can delete it anytime to revoke access, or remove the app under [Google Account → Security → Third-party access](https://myaccount.google.com/permissions).

**Which calendar does the event go to?**
Your main ("primary") Google Calendar.

**Can I write in Persian?**
Persian (Jalali) dates like "28 Shahrivar" are supported and converted automatically. Keep the rest of the sentence simple for best results.

**What time zone is used?**
Tehran time (`Asia/Tehran`).

**The event was created with the wrong date/time. Why?**
The AI occasionally misreads unusual phrasings. Always glance at the created event; delete it in Google Calendar and try again with a more explicit request.

**Can I add several events at once?**
Not yet — one event per run. Run the app again for the next event.

**Does it need the internet?**
Yes, for both the AI and Google Calendar.
