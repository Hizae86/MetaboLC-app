"""Validate module: rules engine API (koine-rules@1.0.0).

GET  /api/validation/rules                      profiles, change catalogue, criteria and sources
GET  /api/validation/methods/{id}/range         measuring interval the Library can propose (never validated)
POST /api/validation/plan                       experiments and design for a profile and interval
POST /api/validation/evaluate/calibration       back-calculated accuracy of one calibration run (no r² gate)
POST /api/validation/uncertainty                u_c, U and comparison with the TEa
POST /api/validation/change-impact              Table B: what a set of changes requires, and the next version
GET  /api/validation/ivdr-template?method_id=   pre-filled IVDR Art. 5(5)(d) justification (MDCG 2023-1 §3.6)

The rules live in backend/validation_rules.py; these routes only validate input and call them.
Nothing is stored.
"""
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import validation_rules as vr
from backend.database import get_db
from backend.models import Method
from backend.rate_limit import rate_limit
from backend.visibility import PUBLIC_STATUSES

router = APIRouter()
Profile = Literal["bioanalysis_m10", "clinical_inhouse", "clinical_ceivd", "own"]
_LIMIT = Depends(rate_limit("validation_engine", max_calls=300, window_seconds=3600))


def _bad(e: ValueError):
    raise HTTPException(status_code=422, detail=str(e))


@router.get("/validation/rules")
def rules():
    return vr.rules_catalog()


@router.get("/validation/methods/{method_id}/range")
def method_range(method_id: int, db: Session = Depends(get_db)):
    m = (db.query(Method.id, Method.title, Method.lloq, Method.uloq, Method.lloq_unit, Method.validation_units,
                  Method.matrix)
         .filter(Method.id == method_id, Method.status.in_(PUBLIC_STATUSES)).first())
    if not m:
        raise HTTPException(status_code=404, detail="Method not found")
    out = vr.suggest_range(m.lloq, m.uloq, m.validation_units or m.lloq_unit)
    out.update({"method_id": m.id, "title": m.title, "matrix": m.matrix})
    return out


@router.get("/validation/ivdr-template")
def ivdr_template(method_id: Optional[int] = None, db: Session = Depends(get_db)):
    analyte = matrix = title = None
    if method_id is not None:
        m = (db.query(Method.analyte, Method.matrix, Method.title)
             .filter(Method.id == method_id, Method.status.in_(PUBLIC_STATUSES)).first())
        if not m:
            raise HTTPException(status_code=404, detail="Method not found")
        analyte, matrix, title = m.analyte, m.matrix, m.title
    return vr.ivdr_template(analyte, matrix, title)


class PlanIn(BaseModel):
    profile: Profile
    lloq: Optional[float] = Field(None, gt=0)
    uloq: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=20)
    range_confirmed: bool = False
    n_calibrators: int = Field(8, ge=2, le=20)
    high_risk: bool = False
    near_zero: bool = False
    dilution_factors: List[float] = Field(default_factory=list, max_length=10)
    matrix: Optional[str] = Field(None, max_length=100)
    decision_points: List[float] = Field(default_factory=list, max_length=10)
    method_id: Optional[int] = None
    hil: Optional[Dict[str, float]] = None   # haemoglobin_mg_dl, bilirubin_mg_dl, triglycerides_mg_dl


@router.post("/validation/plan", dependencies=[_LIMIT])
def plan(body: PlanIn, db: Session = Depends(get_db)):
    matrix = body.matrix
    if body.method_id is not None and not matrix:
        m = db.query(Method.matrix).filter(Method.id == body.method_id, Method.status.in_(PUBLIC_STATUSES)).first()
        matrix = m.matrix if m else None
    try:
        out = vr.build_plan(body.profile, body.lloq, body.uloq, body.unit, range_confirmed=body.range_confirmed,
                            n_calibrators=body.n_calibrators, high_risk=body.high_risk, near_zero=body.near_zero,
                            dilution_factors=body.dilution_factors, matrix=matrix,
                            decision_points=body.decision_points or None, hil=body.hil)
    except ValueError as e:
        _bad(e)
    out["method_id"] = body.method_id
    return out


class CalibrationIn(BaseModel):
    profile: Profile
    nominal: List[float] = Field(..., min_length=2, max_length=30)
    response: Optional[List[float]] = Field(None, max_length=30)
    measured: Optional[List[float]] = Field(None, max_length=30)
    weighting: Literal["auto", "1", "1/x", "1/x2"] = "auto"


@router.post("/validation/evaluate/calibration", dependencies=[_LIMIT])
def calibration(body: CalibrationIn):
    try:
        return vr.evaluate_calibration(body.profile, body.nominal, body.response, body.measured, body.weighting)
    except ValueError as e:
        _bad(e)


class UncertaintyIn(BaseModel):
    u_rw_pct: float = Field(..., ge=0)
    u_bias_pct: Optional[float] = Field(None, ge=0)
    bias_pct: Optional[float] = None
    u_cref_pct: Optional[float] = Field(None, ge=0)
    k: float = Field(2.0, gt=0, le=4)
    tea_pct: Optional[float] = Field(None, gt=0)


@router.post("/validation/uncertainty", dependencies=[_LIMIT])
def uncertainty(body: UncertaintyIn):
    try:
        return vr.uncertainty_budget(body.u_rw_pct, u_bias_pct=body.u_bias_pct, bias_pct=body.bias_pct,
                                     u_cref_pct=body.u_cref_pct, k=body.k, tea_pct=body.tea_pct)
    except ValueError as e:
        _bad(e)


class ChangeIn(BaseModel):
    changes: List[str] = Field(..., min_length=1, max_length=25)
    profile: Profile = "clinical_inhouse"
    current_version: str = Field("v1.0", max_length=12)


@router.post("/validation/change-impact", dependencies=[_LIMIT])
def change_impact(body: ChangeIn):
    try:
        return vr.change_impact(body.changes, body.profile, body.current_version)
    except ValueError as e:
        _bad(e)
