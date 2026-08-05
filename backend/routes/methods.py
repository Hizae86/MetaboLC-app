import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from backend.database import get_db
from backend.models import Method, GradientStep, MRMTransition, CompoundValidation, MethodConfirmation
from datetime import datetime

router = APIRouter()

class ConfirmationCreate(BaseModel):
    laboratory: Optional[str] = None
    country: Optional[str] = None
    instrument: Optional[str] = None
    comment: Optional[str] = None
    rating: Optional[int] = None

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
    submitted_by_email: Optional[str] = None
    status: Optional[str] = "pending"
    is_derivatized: Optional[int] = 0
    validation_units: Optional[str] = None
    analyte_normalized: Optional[str] = None

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
    status: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[str] = None
    validation_units: Optional[str] = None
    is_derivatized: Optional[int] = 0
    gradient_steps: List[GradientStepResponse] = []
    mrm_transitions: List[MRMTransitionResponse] = []
    class Config:
        orm_mode = True

@router.get("/compounds")
def get_compounds(db: Session = Depends(get_db)):
    from sqlalchemy import text
    rows = db.execute(text("""
        SELECT 
            MIN(compound_name) as name,
            pubchem_cid,
            MIN(pubchem_formula) as formula,
            MIN(pubchem_exact_mass) as exact_mass,
            COUNT(DISTINCT method_id) as method_count,
            GROUP_CONCAT(DISTINCT method_id) as method_ids
        FROM mrm_transitions
        WHERE is_internal_standard = 0
        AND compound_name IS NOT NULL
        GROUP BY 
            CASE WHEN pubchem_cid IS NOT NULL AND pubchem_cid > 0 
                 THEN CAST(pubchem_cid AS TEXT)
                 ELSE LOWER(TRIM(compound_name))
            END
        ORDER BY method_count DESC
    """)).fetchall()
    
    result = []
    for r in rows:
        method_ids = [int(x) for x in (r.method_ids or '').split(',') if x]
        # Get matrix info for each method
        methods_info = []
        for mid in method_ids[:5]:
            m = db.query(Method).filter(Method.id == mid).first()
            if m:
                methods_info.append({
                    'id': m.id,
                    'matrix': m.matrix,
                    'instrument': m.instrument_manufacturer,
                    'status': m.status
                })
        result.append({
            'name': r.name,
            'pubchem_cid': r.pubchem_cid,
            'formula': r.formula,
            'exact_mass': float(r.exact_mass) if r.exact_mass else None,
            'method_count': r.method_count,
            'methods': methods_info
        })
    return result

@router.get("/summary")
def get_methods_summary(db: Session = Depends(get_db)):
    """Lightweight endpoint for method cards - no transitions"""
    methods = db.query(Method).all()
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
    } for m in methods]

@router.get("/trending")
def get_trending(db: Session = Depends(get_db)):
    from sqlalchemy import text
    methods = db.query(Method).order_by(text('view_count DESC')).limit(8).all()
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
        Method.submitted_by != None
    ).group_by(
        Method.submitted_by
    ).order_by(
        func.count(Method.id).desc()
    ).all()
    return [{"name": r.submitted_by, "laboratory": r.laboratory,
             "country": r.country, "method_count": r.method_count} for r in results]

@router.get("/all", response_model=List[MethodResponse])
def get_all_methods(db: Session = Depends(get_db)):
    return db.query(Method).all()

@router.get("/", response_model=List[MethodResponse])
def get_methods(db: Session = Depends(get_db)):
    return db.query(Method).all()

@router.get("/{method_id}", response_model=MethodResponse)
def get_method(method_id: int, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    return method

@router.post("/", response_model=MethodResponse)
def create_method(method: MethodCreate, db: Session = Depends(get_db)):
    db_method = Method(**method.dict())
    db.add(db_method)
    db.commit()
    db.refresh(db_method)
    return db_method

@router.put("/{method_id}", response_model=MethodResponse)
def update_method(method_id: int, method: MethodCreate, db: Session = Depends(get_db)):
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

@router.put("/{method_id}/verify")
def verify_method(method_id: int, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    if method.status == 'verified':
        method.status = 'pending'
        method.verified_by = None
        method.verified_at = None
    else:
        method.status = 'verified'
        method.verified_by = 'Admin'
        method.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(method)
    return {"status": method.status, "verified_by": method.verified_by, "verified_at": str(method.verified_at)}

@router.delete("/{method_id}")
def delete_method(method_id: int, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    db.delete(method)
    db.commit()
    return {"message": "Method deleted"}

@router.get("/{method_id}/export-mrm")
def export_mrm(method_id: int, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    lines = ["Compound,Type,Precursor m/z,Product m/z,CE (eV),DP (V),CXP (V),RT (min),Dwell (ms)"]
    for t in method.mrm_transitions:
        role = "IS" if t.is_internal_standard else ("Q1" if t.is_quantifier else "Q2")
        lines.append(f"{t.compound_name},{role},{t.precursor_mz},{t.product_mz},{t.collision_energy_ev or ''},{t.declustering_potential or ''},{t.cell_exit_potential or ''},{t.retention_time_min or ''},{t.dwell_time_ms or ''}")
    content = "\n".join(lines)
    filename = f"MRM_{method.analyte_normalized or method.id}.csv"
    return {"content": content, "filename": filename}

@router.post("/{method_id}/upload-chromatogram")
def upload_chromatogram(method_id: int, db: Session = Depends(get_db)):
    return {"message": "Not implemented"}

@router.post("/{method_id}/upload-sop")
def upload_sop(method_id: int, db: Session = Depends(get_db)):
    return {"message": "Not implemented"}

class GradientUpdate(BaseModel):
    steps: list

@router.put("/{method_id}/gradient")
def update_gradient(method_id: int, payload: GradientUpdate, db: Session = Depends(get_db)):
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
def update_transitions(method_id: int, payload: TransitionsUpdate, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    db.query(MRMTransition).filter(MRMTransition.method_id == method_id).delete()
    for t in payload.transitions:
        valid = {k: v for k, v in t.items() if k in {
            'compound_name','is_internal_standard','precursor_mz','product_mz',
            'collision_energy_ev','declustering_potential','cell_exit_potential',
            'retention_time_min','retention_time_window_min','dwell_time_ms','is_quantifier',
            'cone_voltage','cell_accelerator_voltage',
            'q1_pre_bias','q3_pre_bias',
            'ms_resolution','max_inject_time_ms','rf_lens_v','derivative'
        }}
        if valid.get('precursor_mz') and valid.get('product_mz') and valid.get('compound_name'):
            db.add(MRMTransition(method_id=method_id, **valid))
    db.commit()
    return {"message": "Transitions updated"}

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
def get_validation(method_id: int, db: Session = Depends(get_db)):
    return db.query(CompoundValidation).filter(CompoundValidation.method_id == method_id).all()

@router.put("/{method_id}/validation")
def update_validation(method_id: int, payload: ValidationUpdate, db: Session = Depends(get_db)):
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

@router.post("/chat")
def chat_with_massa(request: dict, db: Session = Depends(get_db)):
    import os
    if not os.getenv("ANTHROPIC_API_KEY"):
        return {"response": "AI features are not available in the public demo. Contact the MetaboLC team for access."}
    import anthropic, os
    message = request.get("message", "")
    mode = request.get("mode", "chat")  # chat | draft | troubleshoot

    # Search relevant methods from DB
    keywords = [w.strip().lower() for w in message.replace(',', ' ').split()
                if len(w.strip()) > 3 and w.strip().lower() not in
                ['with', 'this', 'that', 'from', 'what', 'which', 'have', 'been', 'your', 'their']]

    relevant_methods = []
    all_methods = db.query(Method).all()
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

    system_prompt = f"""You are Dra. Massa, the AI advisor of MetaboLC — a clinical LC-MS/MS method repository.

CRITICAL RULE: You ONLY answer based on the methods found in the MetaboLC database provided below. 
- If relevant methods are found: cite them by ID, compare them, and extract specific parameters from them.
- If NO relevant methods are found: say exactly "I don't have methods for this in the MetaboLC repository yet. You can submit one at /submit." Do NOT invent or suggest parameters from general knowledge.
- Never fabricate method parameters, columns, gradients, or transitions that are not in the database.

{db_context if db_context else "No relevant methods found in the MetaboLC database for this query."}

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
    return {"response": response.content[0].text}


@router.get("/{method_id}/confirmations")
def get_confirmations(method_id: int, db: Session = Depends(get_db)):
    confs = db.query(MethodConfirmation).filter(
        MethodConfirmation.method_id == method_id
    ).order_by(MethodConfirmation.created_at.desc()).all()
    return [{"id":c.id,"method_id":c.method_id,"laboratory":c.laboratory,
             "country":c.country,"instrument":c.instrument,"comment":c.comment,
             "rating":c.rating,"created_at":str(c.created_at)} for c in confs]

@router.post("/{method_id}/confirmations")
def add_confirmation(method_id: int, conf: ConfirmationCreate, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    c = MethodConfirmation(method_id=method_id, **conf.dict())
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id":c.id,"message":"Confirmation added"}
