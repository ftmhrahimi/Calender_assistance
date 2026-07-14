# Code Review — Calendar Assistance

Findings from a review of the current codebase. **None of these have been implemented** — the application behavior is unchanged. Items are recorded here so they can be prioritized deliberately.

Severity: 🔴 critical · 🟠 important · 🟡 nice-to-have

---

## 1. Security Observations

### 🔴 1.1 Hardcoded API secret in source control

`Combinev_org.py` defines `DEEPINFRA_API_TOKEN` as a literal string. It is committed to a public GitHub repository, so it must be considered compromised.

- **Recommended action (out of band, no code change required first):** revoke/rotate the token in the DeepInfra dashboard immediately.
- **Recommended code change:** load it from the environment instead, e.g. `os.environ["DEEPINFRA_API_TOKEN"]` (optionally via `python-dotenv` and the provided `.env.example`), and fail fast with a clear message when unset. Note that rotating alone is not enough long-term — the old value remains in git history.

### 🟠 1.2 OAuth scope is broader than needed

The scope `https://www.googleapis.com/auth/calendar` grants full read/write access to *all* calendars. The app only inserts events; `https://www.googleapis.com/auth/calendar.events` would follow the principle of least privilege.

### 🟠 1.3 Sensitive files rely on convention

`token.json` grants live access to the user's calendar. It is now covered by `.gitignore`, but consider restricting file permissions on write (`os.chmod(..., 0o600)`).

### 🟡 1.4 LLM output parsing surface

`ast.literal_eval` is the right choice (no code execution), but the greedy regex `({.*})` grabs from the first `{` to the last `}` in the response; a chatty model response containing multiple braces could yield an unparseable blob. Consider a JSON-mode/structured-output request and `json.loads` with schema validation (e.g. `pydantic`).

## 2. Correctness / Robustness

### 🔴 2.1 `main.py` imports modules that don't exist in the repository

`main.py` imports `Combinev4` and `new_version1`, neither of which is present, so the FastAPI app cannot start (`ModuleNotFoundError`). It also expects a `main(req)` signature, while `Combinev_org.main()` takes no arguments and reads from `input()`. Either commit the missing modules or point the endpoint at a request-taking variant of the pipeline.

### 🟠 2.2 Unvalidated LLM fields can crash the pipeline

`create_event_dict` assumes `summary`, `location`, `start`, `end` all exist and are strings. A missing key raises `KeyError`; per the prompt, absent fields arrive as the *string* `"not provided"`, which would be sent to Google as a literal location or an invalid datetime. Validate fields (and handle `"not provided"`) before building the event body.

### 🟠 2.3 Timezone double-specification risk

The prompt requests datetimes with a `+00:00` (UTC) offset, while the event body sets `timeZone: 'Asia/Tehran'`. Google honors the explicit offset, so events may be shifted by 3.5 hours relative to the user's intent. Either request naive local datetimes (`YYYY-MM-DDTHH:MM:SS`) and let `timeZone` apply, or request the correct `+03:30` offset.

### 🟡 2.4 Broad exception handler hides diagnostics

`main()` catches `Exception` and prints only the message. Fine for users, but consider logging the traceback (`logging.exception`) to a file for supportability.

### 🟡 2.5 Deprecated LangChain APIs

`LLMChain` and `chain({...})` invocation are deprecated (hence the suppressed warning). Migrating to `prompt | llm` (LCEL) with `.invoke()` future-proofs the code against removal in newer LangChain releases.

## 3. Best Practices

- 🟠 **No automated tests.** The parsing (`regex + literal_eval`) and `create_event_dict` mapping are pure functions — easy, high-value unit-test targets that don't require network access.
- 🟡 **Naming**: `Combinev_org.py` (module) and `your_function` (endpoint handler) are development-era names; `calendar_assistant.py` / `insert_event` would communicate intent. (Renames were deliberately not performed in the documentation pass.)
- 🟡 **Commented-out code** (`#result = Combinev4.main(req)`, alternate `MODEL_ID`, `#'attendees'`) should live in git history rather than the source.
- 🟡 **Pin dependency versions** in `requirements.txt` (e.g. `langchain==0.x.y`) for reproducible installs; LangChain in particular moves fast.
- 🟡 **`print` vs `logging`**: user output via `print` is fine for a CLI, but internal diagnostics would benefit from the `logging` module with levels.

## 4. Performance Observations

- 🟡 **LLM latency dominates** (seconds per request); everything else is negligible. If throughput ever matters, the chain (`create_llm_chain`) can be built once and reused across requests — it already is per-run in the CLI, but a server variant should not rebuild it per call (note: the embedded "today" dates would then need to move into the request variables).
- 🟡 **Calendar service reuse**: `build("calendar", "v3", …)` performs discovery; a long-running server should construct it once, not per event.
- 🟡 **Model choice**: Llama 2 70B is large for a field-extraction task; a smaller instruct model (or structured-output mode) would cut latency and cost with likely equal accuracy.

## 5. Functionality Gaps (documented, not bugs)

- Attendees are extracted by the prompt but not added to the event (mapping line is commented out).
- One event per run; no confirmation step before insertion ("create this? y/n" would prevent surprises from LLM misreads).
- `description` is extracted but never mapped into the event body.
