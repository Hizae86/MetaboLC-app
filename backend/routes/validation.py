"""Early-access list for the method validation module, and waitlists for the
modules that are not built yet (Routine).

The modules are not built yet. This only records who wants it, what they
validate with, and which library methods they asked to validate, so demand
can be measured before building. Public POST is rate-limited; reading the
list is admin-only.
"""
import csv
import io
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import require_admin
from backend.database import engine, get_db
from backend.models import Method, ValidationWaitlist
from backend.rate_limit import rate_limit

router = APIRouter()

# The table is new; create it on first import so a fresh deployment works
# without a migration step. checkfirst=True makes this a no-op afterwards.
ValidationWaitlist.__table__.create(bind=engine, checkfirst=True)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
ROLES = {"Laboratory director", "Scientist / specialist", "Technician", "Quality manager", "Consultant", "Other"}
GUIDELINES = {"ICH M10", "CLSI (C62 / EP series)", "ISO 15189 / IVDR in-house", "Own SOP", "Not sure"}
VOLUMES = {"1-2", "3-5", "6-10", ">10"}
# Must match the ids in frontend/src/lib/modules.ts. Trace, Stock & costs and QC were merged
# into Routine and Peer benchmark was dropped (18-11-2026); rows that already name them are kept.
MODULES = {"validate", "routine"}


class WaitlistIn(BaseModel):
    email: str = Field(..., max_length=254)
    name: Optional[str] = Field(None, max_length=200)
    laboratory: Optional[str] = Field(None, max_length=200)
    country: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = None
    vendor: Optional[str] = Field(None, max_length=100)
    guideline: Optional[str] = None
    methods_per_year: Optional[str] = None
    method_id: Optional[int] = None
    note: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=50)
    modules: list[str] = Field(default_factory=list, max_length=10)
    consent: bool = False


def _clean(v: Optional[str]) -> Optional[str]:
    v = (v or "").strip()
    return v or None


@router.post("/validation/waitlist",
             dependencies=[Depends(rate_limit("validation_waitlist", max_calls=5, window_seconds=3600))])
@router.post("/modules/waitlist",
             dependencies=[Depends(rate_limit("validation_waitlist", max_calls=5, window_seconds=3600))])
def join_waitlist(body: WaitlistIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")
    if not body.consent:
        raise HTTPException(status_code=422, detail="Consent is required to store your details.")
    for value, allowed, label in ((body.role, ROLES, "role"), (body.guideline, GUIDELINES, "guideline"),
                                  (body.methods_per_year, VOLUMES, "methods per year")):
        if value and value not in allowed:
            raise HTTPException(status_code=422, detail=f"Unknown {label}.")
    unknown = [m for m in body.modules if m not in MODULES]
    if unknown:
        raise HTTPException(status_code=422, detail="Unknown module.")
    method_id = None
    if body.method_id is not None:
        m = db.query(Method.id).filter(Method.id == body.method_id, Method.status.in_(("pending", "verified"))).first()
        method_id = m[0] if m else None

    now = datetime.utcnow()
    row = db.query(ValidationWaitlist).filter(ValidationWaitlist.email == email).first()
    if row is None:
        row = ValidationWaitlist(email=email, created_at=now)
        db.add(row)
    for field in ("name", "laboratory", "country", "role", "vendor", "guideline", "methods_per_year", "note", "source"):
        value = _clean(getattr(body, field))
        if value is not None:
            setattr(row, field, value)
    if method_id is not None:
        ids = [x for x in (row.method_ids or "").split(",") if x]
        if str(method_id) not in ids:
            ids.append(str(method_id))
        row.method_ids = ",".join(ids)[:500]
    if body.modules:
        have = [x for x in (row.modules or "").split(",") if x]
        row.modules = ",".join(have + [m for m in body.modules if m not in have])[:200]
    row.consent_at = now
    row.updated_at = now
    db.commit()
    # Same answer whether the email was new or already listed: don't reveal who signed up.
    return {"ok": True}


FIELDS = ["id", "email", "name", "laboratory", "country", "role", "vendor", "guideline",
          "methods_per_year", "method_ids", "modules", "note", "source", "consent_at", "created_at", "updated_at"]


@router.get("/validation/waitlist", dependencies=[Depends(require_admin)])
def list_waitlist(db: Session = Depends(get_db)):
    rows = db.query(ValidationWaitlist).order_by(ValidationWaitlist.created_at.desc()).all()
    demand: dict = {}
    for r in rows:
        for x in (r.method_ids or "").split(","):
            if x:
                demand[int(x)] = demand.get(int(x), 0) + 1
    titles = dict(db.query(Method.id, Method.title).filter(Method.id.in_(list(demand) or [0])).all())
    modules: dict = {}
    for r in rows:
        for x in (r.modules or "").split(","):
            if x:
                modules[x] = modules.get(x, 0) + 1
    return {
        "count": len(rows),
        "entries": [{f: (str(getattr(r, f)) if isinstance(getattr(r, f), datetime) else getattr(r, f)) for f in FIELDS} for r in rows],
        "module_demand": sorted(({"module": k, "requests": v} for k, v in modules.items()), key=lambda d: -d["requests"]),
        "method_demand": sorted(({"method_id": k, "title": titles.get(k), "requests": v} for k, v in demand.items()),
                                key=lambda d: -d["requests"]),
    }


@router.get("/validation/waitlist.csv", dependencies=[Depends(require_admin)])
def export_waitlist(db: Session = Depends(get_db)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(FIELDS)
    for r in db.query(ValidationWaitlist).order_by(ValidationWaitlist.created_at).all():
        w.writerow([getattr(r, f) if getattr(r, f) is not None else "" for f in FIELDS])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=metabolc-validation-early-access.csv"})
