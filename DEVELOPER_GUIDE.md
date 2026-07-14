# Developer Guide — Calendar Assistance

A practical guide for developers who want to understand, debug, or extend the project.

---

## 1. How to Understand the Project

**Read in this order:**

1. [README.md](README.md) — what the project does and how to run it.
2. `Combinev_org.py` — the entire pipeline, top to bottom (~200 lines). The `main()` function at the bottom is the map: five calls, one per pipeline stage.
3. [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) — architecture and diagrams.
4. [API_FLOW.md](API_FLOW.md) — the request lifecycle step by step.

**Mental model:** the app is a straight line —

```text
input → LLM extraction → parse → event body → OAuth → Calendar insert → link
```

Each stage is one function; there is no shared state between stages except the values passed along.

## 2. File Responsibilities

| File | Owns |
|---|---|
| `Combinev_org.py` | Everything: prompt construction, LLM call, parsing, event mapping, OAuth, Calendar insert, CLI presentation |
| `main.py` | HTTP exposure only (FastAPI `POST /insert`); no business logic |
| `requirements.txt` | Dependency manifest |
| `.env.example` | Documents required configuration |
| `credentials.json` / `token.json` | Secrets — never commit, both git-ignored |

## 3. How to Debug

### See what the LLM actually returned

The most common failure is parsing. Temporarily print the raw response inside `get_user_request` (before the regex) while debugging:

```python
response = llm_chain({'request': user_req})
print("RAW LLM RESPONSE:", response['text'])   # debug only — remove before commit
```

### Test parsing without spending LLM calls

Feed a canned response through the same regex + `ast.literal_eval` in a REPL:

```python
import re, ast
text = "Sure! {'summary': 'lunch', 'start': '2026-07-15T13:00:00+00:00', 'end': '2026-07-15T14:00:00+00:00', 'location': 'cafe'}"
ast.literal_eval(re.search(r"({.*})", text, re.DOTALL).group(1))
```

### Test Calendar insertion without the LLM

Call the Google half of the pipeline directly with a hand-written event:

```python
from Combinev_org import get_google_credentials, create_google_calendar_event, create_event_dict
event = create_event_dict({'summary': 'test', 'location': 'here',
                           'start': '2026-07-15T10:00:00+00:00',
                           'end': '2026-07-15T11:00:00+00:00'})
create_google_calendar_event(get_google_credentials(), event)
```

### Auth problems

Delete `token.json` to force a fresh browser consent flow. Check the OAuth consent screen test-user list if Google blocks the login.

### Surfacing hidden errors

`main()` swallows all exceptions into one message. While debugging, temporarily add `raise` after the print in its `except` block to get the full traceback.

## 4. Where to Add Features

| Feature | Where |
|---|---|
| New extracted field (e.g. attendees, description) | 1) The prompt in `create_llm_chain` already requests it → 2) map it in `create_event_dict` |
| Different LLM/model | `MODEL_ID` constant, or swap the `DeepInfra` class in `create_llm_chain` for another LangChain LLM |
| Different time zone / calendar | `create_event_dict` (`timeZone`) and `create_google_calendar_event` (`calendarId`) |
| Multiple events per session | Wrap the body of `main()` in a loop |
| New interface (web, bot, …) | Follow `main.py`'s pattern: import the pipeline, feed it a string |
| Output formatting | `print_banner` and the `print` calls in `create_google_calendar_event` / `main` |

## 5. Coding Conventions

- **Style**: PEP 8; 4-space indentation; `snake_case` functions, `UPPER_CASE` module constants.
- **Docstrings**: Google style (`Args:` / `Returns:` / `Raises:`) on every public function; every module starts with a module docstring.
- **Comments**: only where the code cannot speak for itself (e.g. why a warning is suppressed). No narration of obvious lines.
- **Structure**: one function per pipeline stage; functions receive their inputs as parameters rather than reading globals (constants excepted).
- **Errors**: raise specific exceptions inside stages; catch and present them only at the boundary (`main()`), keeping user-facing messages friendly.
- **Secrets**: never hardcode new secrets; prefer environment variables (see [CODE_REVIEW.md](CODE_REVIEW.md)).
- **Behavior**: prompt wording and scheduling logic are considered production-sensitive — do not alter them casually; test end-to-end after any change.

## 6. Local Development Loop

```bash
make install     # venv + dependencies (or: pip install -r requirements.txt)
make run         # python Combinev_org.py
make clean       # remove caches
```

Before committing: run the app end-to-end once (real LLM + a throwaway calendar event), since there is currently no automated test suite.
