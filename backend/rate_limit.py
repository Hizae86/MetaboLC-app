"""Very small in-memory rate limiter for the public AI endpoints.

MetaboLC's /chat and /generate-sop endpoints call the Anthropic API with the
server's own API key, with no per-user cost control. This limits how many
requests a single client IP can make to a given endpoint ("bucket") in a
time window, so one visitor (or a bot) can't run up an unbounded Anthropic
bill or DoS the server.

Known limitation: state lives in this process's memory only. It is NOT
shared across multiple uvicorn workers or multiple server instances, and it
resets on every restart/deploy. That is fine for a single-process bootstrap
deployment; if MetaboLC moves to multiple workers/instances, replace this
with a shared store (e.g. Redis, or the `slowapi` package with a Redis
backend) so the limit applies across all of them.
"""
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status

_lock = threading.Lock()
_hits: Dict[str, Deque] = defaultdict(deque)


def _client_key(request: Request, bucket: str) -> str:
    # Most hosting platforms (Vercel included) put the real client IP in
    # X-Forwarded-For when proxying; fall back to the raw connection address.
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else "unknown"
    )
    return f"{bucket}:{ip}"


def rate_limit(bucket: str, max_calls: int, window_seconds: int):
    """Returns a FastAPI dependency allowing at most `max_calls` requests
    per `window_seconds`, per client IP, for this `bucket` (usually the
    route's name)."""

    def _dependency(request: Request) -> None:
        key = _client_key(request, bucket)
        now = time.monotonic()
        with _lock:
            hits = _hits[key]
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            if len(hits) >= max_calls:
                retry_after = max(1, int(window_seconds - (now - hits[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Try again in {retry_after}s.",
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now)

    return _dependency
