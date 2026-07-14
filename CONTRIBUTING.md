# Contributing to Calendar Assistance

Thank you for considering a contribution! 🎉

## Getting Started

1. **Fork** the repository and clone your fork.
2. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Set up your own `credentials.json` and DeepInfra token (see [README.md](README.md)) — never use or commit anyone else's.
4. Read the [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) to understand the pipeline.

## Making Changes

1. Create a feature branch: `git checkout -b feature/short-description`.
2. Keep changes focused — one topic per pull request.
3. Follow the conventions in [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md): PEP 8, Google-style docstrings, errors surfaced at the boundary.
4. **Test end-to-end** before submitting: run `python Combinev_org.py` and create a real (throwaway) event.
5. Update documentation (README, guides) when behavior or setup changes.
6. Add an entry under *Unreleased* in [CHANGELOG.md](CHANGELOG.md).

## Commit Messages

- Use the imperative mood: `Add attendee support`, not `Added…`.
- First line ≤ 72 characters; add a body when the *why* isn't obvious.

## Pull Requests

- Describe **what** changed and **why**, plus how you tested it.
- Link related issues.
- PRs that change the LLM prompt or scheduling behavior must describe the inputs they were validated against (Persian dates, relative dates, missing fields).

## Reporting Bugs

Open a GitHub issue including:

- The exact request you typed (redact anything personal).
- The full error message.
- Python version and OS.

## Security

If you discover a security issue (e.g. credential exposure), please **do not** open a public issue — contact the maintainer directly.

## Ground Rules

- Never commit secrets: `credentials.json`, `token.json`, API tokens, `.env`.
- Improvements you notice but don't implement belong in [CODE_REVIEW.md](CODE_REVIEW.md).
- Be respectful and constructive in reviews and discussions.
