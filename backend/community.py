"""Community reviews: laboratories that ran a method say whether it worked.

A review has one of three outcomes. New reviews wait for a moderator
(status "pending") before anyone else sees them; a moderator publishes or
hides them. Rows written before reviews existed have no status or outcome:
they were public confirmations that the method worked, so they count as
published and "as_published".
"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models import MethodConfirmation

OUTCOMES = ("as_published", "with_changes", "failed")
STATUSES = ("pending", "published", "hidden")


def _status():
    return func.coalesce(MethodConfirmation.status, "published")


def _outcome():
    return func.coalesce(MethodConfirmation.outcome, "as_published")


def summaries(db: Session, method_ids: list[int]) -> dict[int, dict]:
    """Published review counts per method, by outcome."""
    out: dict[int, dict] = {}
    if not method_ids:
        return out
    rows = (db.query(MethodConfirmation.method_id, _outcome(), func.count())
              .filter(MethodConfirmation.method_id.in_(method_ids), _status() == "published")
              .group_by(MethodConfirmation.method_id, _outcome()).all())
    for mid, outcome, n in rows:
        s = out.setdefault(mid, {k: 0 for k in OUTCOMES} | {"total": 0})
        s[outcome] = s.get(outcome, 0) + n
        s["total"] += n
    return out


def summary(db: Session, method_id: int) -> dict:
    return summaries(db, [method_id]).get(method_id, {k: 0 for k in OUTCOMES} | {"total": 0})


def pending_count(db: Session) -> int:
    return db.query(func.count()).select_from(MethodConfirmation).filter(MethodConfirmation.status == "pending").scalar() or 0
