"""Minimal admin-key authentication for write endpoints.

MetaboLC has no user-accounts system yet, so this is intentionally simple:
a single shared secret (the ADMIN_API_KEY environment variable) that must
be sent as the ``X-Admin-Key`` header on any request that creates, edits,
verifies or deletes published data. It replaces the old client-side-only
"superuser password" in MethodDetail.tsx, which never actually protected
the backend: anyone could call the API directly and skip it entirely.

This does not try to be a full multi-user accounts system — that is a
separate, bigger piece of work (see the "Módulo de Validación y QC" roadmap
in the MetaboLC commercial plan). It only closes the immediate gap: nobody
but you should be able to edit or delete a published method.
"""
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException, status


def require_admin(x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key")) -> None:
    """FastAPI dependency: raises 401/503 unless a valid admin key is sent.

    Add ``Depends(require_admin)`` to any endpoint that must be admin-only.
    """
    expected = os.getenv("ADMIN_API_KEY")
    if not expected:
        # Fail closed: with no key configured on the server, nobody can use
        # admin-only endpoints — never fall back to "allow everyone".
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server is missing ADMIN_API_KEY — admin actions are disabled until it is set.",
        )
    if not x_admin_key or not secrets.compare_digest(x_admin_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid admin key (send it as the X-Admin-Key header).",
        )
