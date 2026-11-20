import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from typing import Optional, List
from pydantic import BaseModel, Field
from backend.database import get_db
from backend.models import Method, GradientStep, MRMTransition, CompoundValidation, MethodConfirmation
from backend.auth import require_admin
from backend.rate_limit import rate_limit
from backend.visibility import ALL_STATUSES, PUBLIC_STATUSES, is_admin, public, visible_or_404
from datetime import datetime
from backend.completeness import calc_completeness, evaluate as evaluate_completeness
from backend import green as green_footprint
from backend import community

router = APIRouter()

@router.get("/admin/ping")
def admin_ping(_: None = Depends(require_admin)):
    """Lets the frontend verify an admin key with no side effects, instead
    of probing a real write endpoint just to check the password."""
    return {"ok": True}

class ConfirmationCreate(BaseModel):
    """A community review: did the method work in your laboratory?"""
    outcome: str
    laboratory: str = Field(..., min_length=2, max_length=200)
    country: Optional[str] = Field(None, max_length=100)
    instrument: Optional[str] = Field(None, max_length=200)
    changes: Optional[str] = Field(None, max_length=500)
    comment: Optional[str] = Field(None, max_length=500)


class ConfirmationModerate(BaseModel):
    status: str

class GradientStepSchema(BaseModel):
    time_min: float
    percent_b: float
    flow_rate_ml_min: Optional[float] = None
    curve: Optional[str] = "linear"

class MRMTransitionSchema(BaseModel):
    compound_name: str
    is_internal_standard: Optional[int] = 0
    precursor_mz: float
    product_mz: float
    collision_energy_ev: Optional[float] = None
    declustering_potential: Optional[float] = None
    cell_exit_potential: Optional[float] = None
    polarity: Optional[str] = 'ESI+'
    assigned_is: Optional[str] = None
    retention_time_min: Optional[float] = None
    retention_time_window_min: Optional[float] = None
    dwell_time_ms: Optional[float] = None
    is_quantifier: Optional[int] = 1
    cone_voltage: Optional[float] = None
    cell_accelerator_voltage: Optional[float] = None
    q1_pre_bias: Optional[float] = None
    q3_pre_bias: Optional[float] = None
    ms_resolution: Optional[str] = None
    max_inject_time_ms: Optional[float] = None
    rf_lens_v: Optional[float] = None
    pubchem_cid: Optional[int] = None
    pubchem_formula: Optional[str] = None
    pubchem_exact_mass: Optional[float] = None
    pubchem_adduct: Optional[str] = None
    derivative: Optional[str] = None
    is_derivatized: Optional[int] = 0
    review_checked: Optional[int] = 0

class MethodCreate(BaseModel):
    title: Optional[str] = None
    analyte: Optional[str] = None
    analyte_normalized: Optional[str] = None
    analyte_cas: Optional[str] = None
    analyte_exact_mass: Optional[float] = None
    matrix: Optional[str] = "plasma"
    clinical_application: Optional[str] = None
    ionization_mode: Optional[str] = "ESI+"
    instrument_manufacturer: Optional[str] = None
    instrument_model: Optional[str] = None
    column_brand: Optional[str] = None
    column_name: Optional[str] = None
    column_stationary_phase: Optional[str] = None
    column_length_mm: Optional[float] = None
    column_diameter_mm: Optional[float] = None
    column_particle_size_um: Optional[float] = None
    column_temperature_c: Optional[float] = None
    mobile_phase_a: Optional[str] = None
    mobile_phase_b: Optional[str] = None
    injection_volume_ul: Optional[float] = None
    autosampler_temperature_c: Optional[float] = None
    needle_wash_solvent: Optional[str] = None
    capillary_voltage_v: Optional[float] = None
    capillary_voltage_pos_v: Optional[float] = None
    capillary_voltage_neg_v: Optional[float] = None
    source_temperature_c: Optional[float] = None
    desolvation_temperature_c: Optional[float] = None
    desolvation_gas_flow: Optional[float] = None
    curtain_gas: Optional[float] = None
    collision_gas: Optional[str] = None
    desolvation_gas_flow_lh: Optional[float] = None
    cone_gas_flow_lh: Optional[float] = None
    interface_voltage_kv: Optional[float] = None
    heating_gas_flow: Optional[float] = None
    dl_temperature: Optional[float] = None
    interface_temperature: Optional[float] = None
    nebulizing_gas: Optional[float] = None
    drying_gas: Optional[float] = None
    heat_block_temperature: Optional[float] = None
    ion_spray_voltage: Optional[float] = None
    gas1: Optional[float] = None
    gas2: Optional[float] = None
    gas_temperature: Optional[float] = None
    gas_flow_lmin: Optional[float] = None
    nebulizer_pressure_psi: Optional[float] = None
    sheath_gas_heater_c: Optional[float] = None
    sheath_gas_flow_lmin: Optional[float] = None
    nozzle_voltage_v: Optional[float] = None
    aux_gas_flow: Optional[float] = None
    sweep_gas_flow: Optional[float] = None
    ion_transfer_tube_temp_c: Optional[float] = None
    vaporizer_temp_c: Optional[float] = None
    capillary_temp_c: Optional[float] = None
    s_lens_rf_level: Optional[float] = None
    data_acquisition_mode: Optional[str] = None
    fullms_resolution: Optional[float] = None
    fullms_scan_range: Optional[str] = None
    ddms2_resolution: Optional[float] = None
    ddms2_isolation_window: Optional[float] = None
    nce_stepped: Optional[str] = None
    ion_mobility_device: Optional[str] = None
    im_separation_voltage_v: Optional[float] = None
    im_compensation_voltage_v: Optional[float] = None
    im_offset_v: Optional[float] = None
    im_temperature_c: Optional[float] = None
    im_resolution: Optional[str] = None
    im_modifier: Optional[str] = None
    sample_prep_method: Optional[str] = None
    sample_prep_details: Optional[str] = None
    lloq: Optional[float] = None
    uloq: Optional[float] = None
    cv_intra_percent: Optional[float] = None
    cv_inter_percent: Optional[float] = None
    recovery_percent: Optional[float] = None
    laboratory: Optional[str] = None
    country: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    submitted_by: Optional[str] = None
    source_type: Optional[str] = None
    source_authors: Optional[str] = None
    source_url: Optional[str] = None
    submitted_by_email: Optional[str] = None
    status: Optional[str] = "pending"
    is_derivatized: Optional[int] = 0
    validation_units: Optional[str] = None
    analyte_normalized: Optional[str] = None
    validation_level: Optional[str] = "RUO"

class GradientStepResponse(GradientStepSchema):
    id: int
    method_id: int
    class Config:
        orm_mode = True

class MRMTransitionResponse(MRMTransitionSchema):
    id: int
    method_id: int
    class Config:
        orm_mode = True

class MethodResponse(BaseModel):
    id: int
    title: Optional[str] = None
    analyte: Optional[str] = None
    analyte_normalized: Optional[str] = None
    analyte_cas: Optional[str] = None
    matrix: Optional[str] = None
    clinical_application: Optional[str] = None
    ionization_mode: Optional[str] = None
    instrument_manufacturer: Optional[str] = None
    instrument_model: Optional[str] = None
    column_brand: Optional[str] = None
    column_name: Optional[str] = None
    column_stationary_phase: Optional[str] = None
    column_length_mm: Optional[float] = None
    column_diameter_mm: Optional[float] = None
    column_particle_size_um: Optional[float] = None
    column_temperature_c: Optional[float] = None
    mobile_phase_a: Optional[str] = None
    mobile_phase_b: Optional[str] = None
    injection_volume_ul: Optional[float] = None
    autosampler_temperature_c: Optional[float] = None
    needle_wash_solvent: Optional[str] = None
    capillary_voltage_v: Optional[float] = None
    capillary_voltage_pos_v: Optional[float] = None
    capillary_voltage_neg_v: Optional[float] = None
    source_temperature_c: Optional[float] = None
    desolvation_temperature_c: Optional[float] = None
    desolvation_gas_flow: Optional[float] = None
    curtain_gas: Optional[float] = None
    collision_gas: Optional[str] = None
    desolvation_gas_flow_lh: Optional[float] = None
    cone_gas_flow_lh: Optional[float] = None
    interface_voltage_kv: Optional[float] = None
    heating_gas_flow: Optional[float] = None
    dl_temperature: Optional[float] = None
    interface_temperature: Optional[float] = None
    nebulizing_gas: Optional[float] = None
    drying_gas: Optional[float] = None
    heat_block_temperature: Optional[float] = None
    ion_spray_voltage: Optional[float] = None
    gas1: Optional[float] = None
    gas2: Optional[float] = None
    gas_temperature: Optional[float] = None
    gas_flow_lmin: Optional[float] = None
    nebulizer_pressure_psi: Optional[float] = None
    sheath_gas_heater_c: Optional[float] = None
    sheath_gas_flow_lmin: Optional[float] = None
    nozzle_voltage_v: Optional[float] = None
    aux_gas_flow: Optional[float] = None
    sweep_gas_flow: Optional[float] = None
    ion_transfer_tube_temp_c: Optional[float] = None
    vaporizer_temp_c: Optional[float] = None
    capillary_temp_c: Optional[float] = None
    s_lens_rf_level: Optional[float] = None
    data_acquisition_mode: Optional[str] = None
    fullms_resolution: Optional[float] = None
    fullms_scan_range: Optional[str] = None
    ddms2_resolution: Optional[float] = None
    ddms2_isolation_window: Optional[float] = None
    nce_stepped: Optional[str] = None
    ion_mobility_device: Optional[str] = None
    im_separation_voltage_v: Optional[float] = None
    im_compensation_voltage_v: Optional[float] = None
    im_offset_v: Optional[float] = None
    im_temperature_c: Optional[float] = None
    im_resolution: Optional[str] = None
    im_modifier: Optional[str] = None
    sample_prep_method: Optional[str] = None
    sample_prep_details: Optional[str] = None
    lloq: Optional[float] = None
    uloq: Optional[float] = None
    cv_intra_percent: Optional[float] = None
    cv_inter_percent: Optional[float] = None
    recovery_percent: Optional[float] = None
    laboratory: Optional[str] = None
    country: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    submitted_by: Optional[str] = None
    source_type: Optional[str] = None
    source_authors: Optional[str] = None
    source_url: Optional[str] = None
    status: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    validation_units: Optional[str] = None
    is_derivatized: Optional[int] = 0
    validation_level: Optional[str] = "RUO"
    completeness_score: Optional[int] = None
    completeness: Optional[dict] = None
    green: Optional[dict] = None
    community: Optional[dict] = None
    gradient_steps: List[GradientStepResponse] = []
    mrm_transitions: List[MRMTransitionResponse] = []
    class Config:
        orm_mode = True

@router.get("/compounds")
def get_compounds(db: Session = Depends(get_db)):
    """Analyte index. One query, aggregated in Python (no GROUP_CONCAT,
    works on SQLite and Postgres). Only public methods are counted."""
    from collections import Counter, defaultdict

    rows = (
        db.query(
            MRMTransition.compound_name,
            MRMTransition.pubchem_cid,
            MRMTransition.pubchem_formula,
            MRMTransition.pubchem_exact_mass,
            MRMTransition.precursor_mz,
            MRMTransition.product_mz,
            MRMTransition.retention_time_min,
            MRMTransition.is_quantifier,
            MRMTransition.polarity,
            Method.id.label("method_id"),
            Method.matrix,
            Method.status,
            Method.clinical_application,
            Method.ionization_mode,
        )
        .join(Method, Method.id == MRMTransition.method_id)
        .filter(
            MRMTransition.is_internal_standard == 0,
            MRMTransition.compound_name.isnot(None),
            Method.status.in_(PUBLIC_STATUSES),
        )
        .all()
    )

    groups = defaultdict(list)
    for r in rows:
        key = str(r.pubchem_cid) if (r.pubchem_cid and r.pubchem_cid > 0) else (r.compound_name or "").strip().lower()
        if key:
            groups[key].append(r)

    result = []
    for key, rs in groups.items():
        methods = {}
        for r in rs:
            methods.setdefault(r.method_id, r)
        quant = [r for r in rs if r.is_quantifier]
        # Consensus quant transition: the (Q1, Q3) pair used by most methods.
        pair_methods = defaultdict(set)
        for r in quant:
            if r.precursor_mz is not None and r.product_mz is not None:
                pair_methods[(round(float(r.precursor_mz), 1), round(float(r.product_mz), 1))].add(r.method_id)
        top = max(pair_methods.items(), key=lambda kv: len(kv[1]))[0] if pair_methods else None
        pol = Counter(
            (r.polarity or r.ionization_mode) for r in quant if (r.polarity or r.ionization_mode)
        )
        rts = [float(r.retention_time_min) for r in quant if r.retention_time_min is not None]
        matrices = sorted({(r.matrix or "").strip().lower() for r in rs if r.matrix})
        apps = sorted({r.clinical_application for r in rs if r.clinical_application})
        names = Counter((r.compound_name or "").strip() for r in rs if r.compound_name)
        result.append({
            "name": names.most_common(1)[0][0],
            "normalized": key,
            "pubchem_cid": next((r.pubchem_cid for r in rs if r.pubchem_cid and r.pubchem_cid > 0), None),
            "formula": next((r.pubchem_formula for r in rs if r.pubchem_formula), None),
            "exact_mass": next((float(r.pubchem_exact_mass) for r in rs if r.pubchem_exact_mass), None),
            "method_count": len(methods),
            "verified_count": sum(1 for m in methods.values() if m.status == "verified"),
            "matrices": matrices,
            "applications": apps,
            "common_transition": {"precursor_mz": top[0], "product_mz": top[1]} if top else None,
            "polarity": pol.most_common(1)[0][0] if pol else None,
            "rt_min": min(rts) if rts else None,
            "rt_max": max(rts) if rts else None,
        })
    result.sort(key=lambda c: (-c["method_count"], c["name"].lower()))
    return result

@router.get("/summary")
def get_methods_summary(db: Session = Depends(get_db)):
    """Lightweight endpoint for method cards - no transitions"""
    methods = public(db.query(Method)).all()
    return [{
        "id": m.id,
        "title": m.title,
        "analyte": m.analyte,
        "matrix": m.matrix,
        "instrument_manufacturer": m.instrument_manufacturer,
        "instrument_model": m.instrument_model,
        "clinical_application": m.clinical_application,
        "status": m.status,
        "lloq": m.lloq,
        "lloq_unit": m.lloq_unit,
        "column_name": m.column_name,
        "country": m.country,
        "laboratory": m.laboratory,
        "mrm_count": len(m.mrm_transitions),
        "chromatogram_svg": m.chromatogram_svg,
        "completeness_score": calc_completeness(m),
    } for m in methods]

@router.get("/trending")
def get_trending(db: Session = Depends(get_db)):
    from sqlalchemy import text
    methods = public(db.query(Method)).order_by(text('view_count DESC')).limit(8).all()
    return [{
        "id": m.id,
        "title": m.title,
        "analyte": m.analyte,
        "matrix": m.matrix,
        "instrument_manufacturer": m.instrument_manufacturer,
        "instrument_model": m.instrument_model,
        "view_count": m.view_count or 0,
        "lloq": m.lloq,
        "status": m.status,
            
    } for m in methods]

@router.get("/contributors")
def get_contributors(db: Session = Depends(get_db)):
    from sqlalchemy import func
    results = db.query(
        Method.submitted_by,
        Method.laboratory,
        Method.country,
        func.count(Method.id).label("method_count")
    ).filter(
        Method.submitted_by != None, Method.status.in_(PUBLIC_STATUSES)
    ).group_by(
        Method.submitted_by
    ).order_by(
        func.count(Method.id).desc()
    ).all()
    return [{"name": r.submitted_by, "laboratory": r.laboratory,
             "country": r.country, "method_count": r.method_count} for r in results]

class StatusChange(BaseModel):
    status: str


@router.get("/review-queue")
def review_queue(status: str = "submitted", db: Session = Depends(get_db), _: None = Depends(require_admin)):
    """Methods waiting for (or removed by) moderation, newest first."""
    if status not in ("submitted", "rejected"):
        raise HTTPException(status_code=422, detail="status must be 'submitted' or 'rejected'")
    rows = db.query(Method).filter(Method.status == status).order_by(Method.created_at.desc()).all()
    return [{
        "id": m.id, "title": m.title, "analyte": m.analyte, "matrix": m.matrix,
        "instrument_manufacturer": m.instrument_manufacturer, "instrument_model": m.instrument_model,
        "submitted_by": m.submitted_by, "submitted_by_email": m.submitted_by_email,
        "laboratory": m.laboratory, "country": m.country,
        "source_type": m.source_type, "reference": m.reference, "source_url": m.source_url,
        "mrm_count": len(m.mrm_transitions), "gradient_count": len(m.gradient_steps),
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in rows]


@router.get("/review-queue/count")
def review_queue_count(db: Session = Depends(get_db), _: None = Depends(require_admin)):
    return {"submitted": db.query(Method).filter(Method.status == "submitted").count(),
            "community_pending": community.pending_count(db)}


@router.get("/review-queue/community")
def community_review_queue(status: str = "pending", db: Session = Depends(get_db), _: None = Depends(require_admin)):
    """Community reviews across all methods, for moderators."""
    if status not in community.STATUSES:
        raise HTTPException(status_code=422, detail="Unknown status.")
    q = db.query(MethodConfirmation, Method.title).join(Method, Method.id == MethodConfirmation.method_id)
    q = q.filter(MethodConfirmation.status == status) if status != "published" else \
        q.filter((MethodConfirmation.status == None) | (MethodConfirmation.status == "published"))  # noqa: E711
    rows = q.order_by(MethodConfirmation.created_at.desc()).limit(200).all()
    return [_review(c, True) | {"method_title": title} for c, title in rows]


@router.get("/all", response_model=List[MethodResponse])
def get_all_methods(db: Session = Depends(get_db)):
    return public(db.query(Method)).all()

@router.get("/", response_model=List[MethodResponse])
def get_methods(db: Session = Depends(get_db)):
    return public(db.query(Method)).all()

@router.get("/{method_id}", response_model=MethodResponse)
def get_method(method_id: int, db: Session = Depends(get_db), admin: bool = Depends(is_admin)):
    method = visible_or_404(db, method_id, admin)
    # Add completeness score to response
    result = {c.name: getattr(method, c.name) for c in method.__table__.columns}
    comp = evaluate_completeness(method)
    result['completeness_score'] = comp['score']
    result['completeness'] = comp
    result['mrm_transitions'] = [
        {c.name: getattr(t, c.name) for c in t.__table__.columns}
        for t in method.mrm_transitions
    ]
    result['gradient_steps'] = [
        {c.name: getattr(s, c.name) for c in s.__table__.columns}
        for s in method.gradient_steps
    ]
    result['compound_validation'] = [
        {c.name: getattr(v, c.name) for c in v.__table__.columns}
        for v in (method.compound_validations or [])
    ]
    # Solvent footprint, ranked against the published methods
    stats = green_footprint.repository_stats(public(db.query(Method)).options(
        selectinload(Method.gradient_steps), selectinload(Method.mrm_transitions)).all())
    result['green'] = green_footprint.with_rank(green_footprint.evaluate(method), stats)
    result['community'] = community.summary(db, method.id)
    return result

class MethodSubmission(MethodCreate):
    """A public submission: the method plus its gradient and transitions."""
    gradient_steps: List[GradientStepSchema] = []
    mrm_transitions: List[MRMTransitionSchema] = []


@router.post("/", response_model=MethodResponse,
             dependencies=[Depends(rate_limit("submit", max_calls=10, window_seconds=3600))])
def create_method(method: MethodSubmission, db: Session = Depends(get_db)):
    """Public endpoint. A submission always enters as "submitted": hidden from
    the public until a reviewer publishes it (see /review-queue). Status and
    verification fields sent by the client are ignored."""
    data = method.dict(exclude={"gradient_steps", "mrm_transitions"})
    data["status"] = "submitted"
    data["verified_by"] = None
    data["verified_at"] = None
    for required in ("title", "analyte", "matrix", "instrument_manufacturer", "instrument_model"):
        if not (data.get(required) or "").strip():
            raise HTTPException(status_code=422, detail=f"'{required}' is required")
    # The database requires these; a submitter may not know them yet.
    data["ionization_mode"] = data.get("ionization_mode") or "ESI+"
    data["column_brand"] = data.get("column_brand") or ""
    data["column_name"] = data.get("column_name") or ""
    db_method = Method(**data)
    db_method.gradient_steps = [GradientStep(**step.dict()) for step in method.gradient_steps]
    db_method.mrm_transitions = [MRMTransition(**{**t.dict(), "review_checked": 0}) for t in method.mrm_transitions]
    db.add(db_method)
    db.commit()
    db.refresh(db_method)
    return db_method

@router.put("/{method_id}", response_model=MethodResponse)
def update_method(method_id: int, method: MethodCreate, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    import sys
    db_method = db.query(Method).filter(Method.id == method_id).first()
    if not db_method:
        raise HTTPException(status_code=404, detail="Method not found")
    update_data = method.dict(exclude={"gradient_steps", "mrm_transitions"})
    for key, value in update_data.items():
        setattr(db_method, key, value)
    db.commit()
    db.refresh(db_method)
    return db_method

@router.put("/{method_id}/status")
def set_status(method_id: int, change: StatusChange, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    """Moderation: publish (pending), publish as verified, reject, or send back to the queue."""
    if change.status not in ALL_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {', '.join(ALL_STATUSES)}")
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    method.status = change.status
    if change.status == "verified":
        method.verified_by = os.getenv("REVIEWER_NAME") or "Koiné reviewer"
        method.verified_at = datetime.utcnow()
    else:
        method.verified_by = None
        method.verified_at = None
    db.commit()
    return {"id": method.id, "status": method.status, "verified_by": method.verified_by,
            "verified_at": str(method.verified_at) if method.verified_at else None}


@router.put("/{method_id}/verify")
def verify_method(method_id: int, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    if method.status == 'verified':
        method.status = 'pending'
        method.verified_by = None
        method.verified_at = None
    else:
        method.status = 'verified'
        method.verified_by = os.getenv("REVIEWER_NAME") or "Koiné reviewer"
        method.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(method)
    return {"status": method.status, "verified_by": method.verified_by, "verified_at": str(method.verified_at)}

@router.delete("/{method_id}")
def delete_method(method_id: int, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    db.delete(method)
    db.commit()
    return {"message": "Method deleted"}

@router.get("/{method_id}/export-mrm")
def export_mrm(method_id: int, db: Session = Depends(get_db)):
    """Kept for older clients; same content as /api/methods/{id}/export/generic."""
    from backend.exports import FORMATS, filename, render
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    fmt = FORMATS["generic"]
    return {"content": render(fmt, method), "filename": filename(fmt, method)}

@router.post("/{method_id}/upload-chromatogram")
def upload_chromatogram(method_id: int, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    return {"message": "Not implemented"}

@router.post("/{method_id}/upload-sop")
def upload_sop(method_id: int, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    return {"message": "Not implemented"}

class GradientUpdate(BaseModel):
    steps: list

@router.put("/{method_id}/gradient")
def update_gradient(method_id: int, payload: GradientUpdate, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    db.query(GradientStep).filter(GradientStep.method_id == method_id).delete()
    for step in payload.steps:
        s = {k: v for k, v in step.items() if k in {'time_min','percent_b','flow_rate_ml_min','curve'}}
        db.add(GradientStep(method_id=method_id, **s))
    db.commit()
    return {"message": "Gradient updated"}

class TransitionsUpdate(BaseModel):
    transitions: list

@router.put("/{method_id}/transitions")
def update_transitions(method_id: int, payload: TransitionsUpdate, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    db.query(MRMTransition).filter(MRMTransition.method_id == method_id).delete()
    for t in payload.transitions:
        valid = {k: v for k, v in t.items() if k in {
            'compound_name','is_internal_standard','precursor_mz','product_mz',
            'collision_energy_ev','declustering_potential','cell_exit_potential','polarity','assigned_is',
            'retention_time_min','retention_time_window_min','dwell_time_ms','is_quantifier',
            'cone_voltage','cell_accelerator_voltage',
            'q1_pre_bias','q3_pre_bias',
            'ms_resolution','max_inject_time_ms','rf_lens_v','derivative','is_derivatized',
            'pubchem_cid','pubchem_formula','pubchem_exact_mass','pubchem_adduct','review_checked'
        }}
        if valid.get('precursor_mz') and valid.get('product_mz') and valid.get('compound_name'):
            db.add(MRMTransition(method_id=method_id, **valid))
    db.commit()
    return {"message": "Transitions updated"}

POLARITIES = {"ESI+", "ESI-", "APCI+", "APCI-", "APPI+", "APPI-"}

class TransitionReview(BaseModel):
    polarity: Optional[str] = None
    review_checked: Optional[int] = None

@router.patch("/{method_id}/transitions/{transition_id}")
def review_transition(method_id: int, transition_id: int, payload: TransitionReview,
                      db: Session = Depends(get_db), _: None = Depends(require_admin)):
    """Reviewer action on one transition flagged by the automatic checks:
    change its polarity and/or confirm that it is correct as recorded."""
    t = db.query(MRMTransition).filter(MRMTransition.id == transition_id, MRMTransition.method_id == method_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transition not found")
    if payload.polarity is not None:
        if payload.polarity not in POLARITIES:
            raise HTTPException(status_code=422, detail=f"Unknown polarity '{payload.polarity}'")
        t.polarity = payload.polarity
    if payload.review_checked is not None:
        t.review_checked = 1 if payload.review_checked else 0
    db.commit()
    db.refresh(t)
    return {"id": t.id, "polarity": t.polarity, "review_checked": t.review_checked or 0}

class ValidationUpdate(BaseModel):
    items: list

class CompoundValidationSchema(BaseModel):
    compound_name: str
    lod: Optional[float] = None
    loq: Optional[float] = None
    r2: Optional[float] = None
    cv_percent: Optional[float] = None
    accuracy_percent: Optional[float] = None
    matrix: Optional[str] = None
    notes: Optional[str] = None

class CompoundValidationResponse(CompoundValidationSchema):
    id: int
    method_id: int
    class Config:
        orm_mode = True

@router.get("/{method_id}/validation", response_model=List[CompoundValidationResponse])
def get_validation(method_id: int, db: Session = Depends(get_db), admin: bool = Depends(is_admin)):
    visible_or_404(db, method_id, admin)
    return db.query(CompoundValidation).filter(CompoundValidation.method_id == method_id).all()

@router.put("/{method_id}/validation")
def update_validation(method_id: int, payload: ValidationUpdate, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    db.query(CompoundValidation).filter(CompoundValidation.method_id == method_id).delete()
    float_fields = ['lod','loq','r2','cv_percent','accuracy_percent']
    allowed = {'compound_name','lod','loq','r2','cv_percent','accuracy_percent','matrix','notes',
               'lod_na','loq_na','r2_na','cv_percent_na','accuracy_percent_na'}
    for item in payload.items:
        valid = {k:v for k,v in item.items() if k in allowed}
        if not valid.get('compound_name'):
            continue
        import re
        for field in float_fields:
            val = valid.get(field)
            if val == 'N/A':
                valid[field] = None
                valid[f'{field}_na'] = 1
            elif val == '' or val is None:
                valid[field] = None
                valid[f'{field}_na'] = 0
            else:
                try:
                    valid[field] = float(val)
                    valid[f'{field}_na'] = 0
                except (ValueError, TypeError):
                    valid[field] = None
                    valid[f'{field}_na'] = 0
        if valid.get('notes'):
            valid['notes'] = re.sub(r'\s*\[[a-z_]+:N/A\]', '', valid['notes']).strip()
        db.add(CompoundValidation(method_id=method_id, **valid))
    db.commit()
    return {"message": "Validation updated"}

class ChatRequest(BaseModel):
    message: str
    conversation: Optional[list] = []

@router.post("/chat", dependencies=[Depends(rate_limit("chat", max_calls=10, window_seconds=60))])
def chat_with_massa(request: dict, db: Session = Depends(get_db)):
    import os
    if not os.getenv("ANTHROPIC_API_KEY"):
        return {
            "reply": "AI features are not available in the public demo. Contact the Koiné team for access.",
            "methods_found": 0,
            "matched_methods": [],
        }
    import anthropic, os
    message = request.get("message", "")
    mode = request.get("mode", "chat")  # chat | draft | troubleshoot

    # Search relevant methods from DB
    keywords = [w.strip().lower() for w in message.replace(',', ' ').split()
                if len(w.strip()) > 3 and w.strip().lower() not in
                ['with', 'this', 'that', 'from', 'what', 'which', 'have', 'been', 'your', 'their']]

    relevant_methods = []
    all_methods = public(db.query(Method)).all()
    for m in all_methods:
        searchable = ' '.join(filter(None, [
            m.analyte or '', m.title or '', m.matrix or '',
            m.clinical_application or '', m.instrument_manufacturer or '',
            m.column_name or '', m.sample_prep_method or '',
        ])).lower()
        score = sum(1 for kw in keywords if kw in searchable)
        if score > 0:
            relevant_methods.append((score, m))

    relevant_methods.sort(key=lambda x: -x[0])
    top_methods = [m for _, m in relevant_methods[:6]]

    # Build DB context
    db_context = ""
    if top_methods:
        db_context = "\n\nRELEVANT METHODS FROM METABOLC DATABASE:\n"
        for m in top_methods:
            transitions = m.mrm_transitions[:3] if m.mrm_transitions else []
            t_str = ', '.join([f"{t.precursor_mz}>{t.product_mz}" for t in transitions])
            db_context += f"""
Method ID {m.id}: {m.title or 'Untitled'}
- Analytes: {m.analyte or 'N/A'}
- Matrix: {m.matrix or 'N/A'}
- Instrument: {m.instrument_manufacturer or ''} {m.instrument_model or ''}
- Column: {m.column_name or 'N/A'} {m.column_length_mm or ''}x{m.column_diameter_mm or ''} mm
- Mobile phase A: {m.mobile_phase_a or 'N/A'}
- Mobile phase B: {m.mobile_phase_b or 'N/A'}
- Sample prep: {m.sample_prep_method or 'N/A'}
- Ionization: {m.ionization_mode or 'N/A'}
- LLOQ: {m.lloq or 'N/A'} ng/mL
- Status: {m.status or 'unverified'}
- Key transitions (Q1>Q3): {t_str or 'N/A'}
- Laboratory: {m.laboratory or 'N/A'}, {m.country or 'N/A'}
"""

    system_prompt = f"""You are the AI assistant of Koiné — a clinical LC-MS/MS method repository.

CRITICAL RULE: You ONLY answer based on the methods found in the Koiné database provided below. 
- If relevant methods are found: cite them by ID, compare them, and extract specific parameters from them.
- If NO relevant methods are found: say exactly "I don't have methods for this in the Koiné repository yet. You can submit one at /submit." Do NOT invent or suggest parameters from general knowledge.
- Never fabricate method parameters, columns, gradients, or transitions that are not in the database.

{db_context if db_context else "No relevant methods found in the Koiné database for this query."}

When methods ARE found, structure your answer as:
1. How many methods exist for this query
2. Key differences between them (matrix, instrument, sample prep, LLOQ)
3. Which one performs best and why (based on LLOQ, verification status, number of confirmations)
4. Specific parameters from the best method(s)

For method drafts: extract parameters ONLY from the database methods above.
For troubleshooting: reference specific methods that solved similar problems."""

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=system_prompt,
        messages=[{"role": "user", "content": message}]
    )
    return {
        "reply": response.content[0].text,
        "methods_found": len(top_methods),
        "matched_methods": [
            {"id": m.id, "title": m.title or f"Method #{m.id}"} for m in top_methods
        ],
    }


def _review(c: MethodConfirmation, admin: bool) -> dict:
    d = {"id": c.id, "method_id": c.method_id, "laboratory": c.laboratory, "country": c.country,
         "instrument": c.instrument, "outcome": c.outcome or "as_published", "changes": c.changes,
         "comment": c.comment, "created_at": str(c.created_at)}
    if admin:
        d["status"] = c.status or "published"
    return d


@router.get("/{method_id}/confirmations")
def get_confirmations(method_id: int, db: Session = Depends(get_db), admin: bool = Depends(is_admin)):
    """Community reviews. The public sees published ones; reviewers also see pending and hidden."""
    visible_or_404(db, method_id, admin)
    q = db.query(MethodConfirmation).filter(MethodConfirmation.method_id == method_id)
    if not admin:
        q = q.filter((MethodConfirmation.status == None) | (MethodConfirmation.status == "published"))  # noqa: E711
    return [_review(c, admin) for c in q.order_by(MethodConfirmation.created_at.desc()).all()]


@router.post("/{method_id}/confirmations",
             dependencies=[Depends(rate_limit("community_review", max_calls=5, window_seconds=3600))])
def add_confirmation(method_id: int, conf: ConfirmationCreate, db: Session = Depends(get_db)):
    """New reviews wait for a moderator before they are shown."""
    visible_or_404(db, method_id)
    if conf.outcome not in community.OUTCOMES:
        raise HTTPException(status_code=422, detail="Unknown outcome.")
    clean = {k: (v.strip() or None) if isinstance(v, str) else v for k, v in conf.dict().items()}
    if clean["outcome"] != "as_published" and not clean.get("changes"):
        raise HTTPException(status_code=422, detail="Please say what you changed or what went wrong.")
    c = MethodConfirmation(method_id=method_id, rating=None, status="pending", **clean)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "status": "pending"}


@router.patch("/{method_id}/confirmations/{review_id}", dependencies=[Depends(require_admin)])
def moderate_confirmation(method_id: int, review_id: int, body: ConfirmationModerate, db: Session = Depends(get_db)):
    if body.status not in community.STATUSES:
        raise HTTPException(status_code=422, detail="Unknown status.")
    c = db.query(MethodConfirmation).filter(MethodConfirmation.id == review_id,
                                            MethodConfirmation.method_id == method_id).first()
    if c is None:
        raise HTTPException(status_code=404, detail="Review not found.")
    c.status = body.status
    db.commit()
    return _review(c, True)

