"""Loads configuration from the project's .env file.

`load_dotenv()` without a path searches upward from the calling file, so the
empty backend/.env used to shadow the real one at the repository root and
ADMIN_API_KEY / ANTHROPIC_API_KEY were never loaded. Load both explicitly:
the root .env first, then backend/.env for anything it does not define.
Variables already set in the environment (e.g. on Render) always win.
"""
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")
