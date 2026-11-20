"""Which methods the public can see.

Status lifecycle:
  submitted  sent through the public form; visible only to reviewers
  pending    published, cites its source, not yet checked against it
  verified   published and checked against its source document by a reviewer
  rejected   not published; kept so a reviewer can restore it

Every public read goes through `public()` or `visible_or_404()`, so a new
submission cannot leak through a listing, the search index, the compound
index, exports or the AI assistant before it has been approved.
"""
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException

from backend.models import Method

PUBLIC_STATUSES = ("pending", "verified")
ALL_STATUSES = ("submitted", "pending", "verified", "rejected")


def public(query):
    return query.filter(Method.status.in_(PUBLIC_STATUSES))


def is_admin(x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key")) -> bool:
    """Dependency that never raises: True only for a valid admin key."""
    expected = os.getenv("ADMIN_API_KEY")
    return bool(expected and x_admin_key and secrets.compare_digest(x_admin_key, expected))


def visible_or_404(db, method_id: int, admin: bool = False) -> Method:
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method or (method.status not in PUBLIC_STATUSES and not admin):
        raise HTTPException(status_code=404, detail="Method not found")
    return method
