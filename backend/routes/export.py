"""Download endpoints for the transition-table exports in backend/exports.py."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.exports import FORMATS, describe, filename, render
from backend.models import Method
from backend.visibility import PUBLIC_STATUSES, is_admin

router = APIRouter()


@router.get("/export-formats")
def list_formats():
    """Available formats with their verification status, for the export menu."""
    return [describe(f) for f in FORMATS.values()]


@router.get("/methods/{method_id}/export/{fmt_key}")
def export_method(method_id: int, fmt_key: str, db: Session = Depends(get_db), admin: bool = Depends(is_admin)):
    fmt = FORMATS.get(fmt_key)
    if not fmt:
        raise HTTPException(status_code=404, detail=f"Unknown export format '{fmt_key}'")
    method = (db.query(Method).options(selectinload(Method.mrm_transitions))
              .filter(Method.id == method_id).first())
    if not method or (method.status not in PUBLIC_STATUSES and not admin):
        raise HTTPException(status_code=404, detail="Method not found")
    if not method.mrm_transitions:
        raise HTTPException(status_code=404, detail="This method has no MRM transitions to export")
    content = render(fmt, method)
    media = "text/tab-separated-values" if fmt.delimiter == "\t" else "text/csv"
    return Response(
        # BOM so Excel opens accents and µ correctly; Skyline and vendor software ignore it.
        content="﻿" + content,
        media_type=f"{media}; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename(fmt, method)}"'},
    )
