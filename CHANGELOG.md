# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-14

### Added

- Natural-language event creation pipeline (`Combinev_org.py`):
  - LLM-based field extraction via LangChain + DeepInfra (Llama 2 70B).
  - Persian (Jalali) and relative date resolution anchored to the current date.
  - Google OAuth 2.0 authentication with token caching and silent refresh.
  - Event insertion into the user's primary Google Calendar (`Asia/Tehran` time zone).
- Optional FastAPI HTTP wrapper (`main.py`) exposing `POST /insert`.
- Interactive CLI with startup banner, icons, and clear success/error messages.
- Full documentation suite: `README.md`, `TECHNICAL_DOCUMENTATION.md`, `API_FLOW.md`,
  `DEVELOPER_GUIDE.md`, `USER_GUIDE.md`, `CONTRIBUTING.md`, `CODE_REVIEW.md`.
- Project hygiene files: `requirements.txt`, `.gitignore`, `.env.example`, `Makefile`, `LICENSE` (MIT).
- Module, class, and function docstrings throughout the codebase.
