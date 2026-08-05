from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Method, MRMTransition
import anthropic
import os
from dotenv import load_dotenv
load_dotenv('/Users/ilciequinteroavila/MetaboLC-app/.env')

router = APIRouter()

def build_sop_prompt(method: Method, transitions: list) -> str:
    # Build transition summary
    quantifiers = [t for t in transitions if t.is_quantifier and not t.is_internal_standard]
    is_trans = [t for t in transitions if t.is_internal_standard]
    
    trans_text = "\n".join([
        f"  - {t.compound_name}: Q1={t.precursor_mz} / Q3={t.product_mz}, CE={t.collision_energy_ev} eV"
        + (f", RT={t.retention_time_min} min" if t.retention_time_min else "")
        for t in quantifiers[:10]
    ])
    
    is_text = "\n".join([
        f"  - {t.compound_name}: Q1={t.precursor_mz} / Q3={t.product_mz}"
        for t in is_trans[:5]
    ])

    return f"""Generate a complete laboratory SOP (Standard Operating Procedure) for validation of the following LC-MS/MS method, following CLSI guidelines EP17-A2 (LLOQ/LOD), EP15-A3 (User Verification of Precision and Bias), and C62-A (LC-MS/MS for Clinical Labs).

METHOD DETAILS:
- Title: {method.title}
- Analytes: {method.analyte}
- Matrix: {method.matrix}
- Instrument: {method.instrument_manufacturer} {method.instrument_model}
- Ionization: {method.ionization_mode}
- Column: {method.column_name or 'Not specified'} {f"{getattr(method,'column_length_mm','?')}x{getattr(method,'column_diameter_mm','?')}mm" if method.column_length_mm else ''}
- Mobile phase A: {method.mobile_phase_a or 'Not specified'}
- Mobile phase B: {method.mobile_phase_b or 'Not specified'}
- Sample preparation: {method.sample_prep_method or 'Not specified'}
- Sample prep details: {method.sample_prep_details or 'Not specified'}
- LLOQ: {method.lloq or 'Not specified'} {method.lloq_unit or 'ng/mL'}
- ULOQ: {method.uloq or 'Not specified'} {method.lloq_unit or 'ng/mL'}
- Injection volume: {method.injection_volume_ul or 'Not specified'} µL
- Column temperature: {method.column_temperature_c or 'Not specified'} °C
- Flow rate: {getattr(method, 'flow_rate_ml_min', None) or 'Not specified'} mL/min

MRM TRANSITIONS (Quantifiers):
{trans_text or 'Not specified'}

INTERNAL STANDARDS:
{is_text or 'Not specified'}

Generate a complete SOP in English with these sections:

# {method.title} - Validation SOP
## Version 1.0 | Based on CLSI EP17-A2, EP15-A3, C62-A

## 1. PURPOSE AND SCOPE
[2-3 sentences]

## 2. MATERIALS AND REAGENTS
### 2.1 Equipment
[List all equipment needed based on the method]
### 2.2 Reagents and Standards
[List reagents, solvents, matrix materials needed]
### 2.3 Internal Standards
[Based on IS transitions above]

## 3. SAMPLE PREPARATION PROTOCOL
[Step-by-step protocol based on sample_prep_method. Be very specific with volumes, times, centrifugation speeds. Use numbered steps.]

## 4. CHROMATOGRAPHIC CONDITIONS
[Table with all LC parameters from the method]

## 5. MS/MS PARAMETERS
[Table with source parameters and MRM transitions with Q1, Q3, CE, DP/Cone]

## 6. VALIDATION EXPERIMENTS (CLSI EP17-A2 + EP15-A3 + C62-A)

### 6.1 Calibration Curve
- Concentration levels: [Calculate 6-8 levels between LLOQ and ULOQ]
- Number of replicates: 3 per level per day
- Number of days: 3
- Acceptance criteria: r² ≥ 0.995, back-calculated concentrations within ±15% (±20% at LLOQ)

### 6.2 LLOQ Verification (CLSI EP17-A2)
- Prepare {method.lloq or 'LLOQ'} {method.lloq_unit or 'ng/mL'} in {method.matrix}
- Number of replicates: 20 (or 5 replicates × 4 days)
- Acceptance criteria: CV ≤ 20%, bias ≤ ±20%, S:N ≥ 10

### 6.3 Precision - Repeatability and Intermediate Precision (CLSI EP15-A3)
[Calculate 3 QC levels: low (~3x LLOQ), medium (mid-range), high (~75% ULOQ)]
- QC Low: [Calculate based on LLOQ]
- QC Medium: [Calculate based on LLOQ and ULOQ]  
- QC High: [Calculate based on ULOQ]
- Design: 5 replicates × 5 days = 25 measurements per level
- Acceptance criteria: CV intra-day ≤ 15%, CV inter-day ≤ 15% (≤20% at LLOQ)

### 6.4 Trueness / Bias
- Use certified reference material or spiked samples
- Acceptance criteria: Bias ≤ ±15% at all levels (≤±20% at LLOQ)

### 6.5 Matrix Effects (CLSI C62-A)
- Prepare post-column infusion or post-extraction spike
- Test minimum 6 individual matrix lots
- Calculate matrix factor (MF) = IS-normalized MF
- Acceptance criteria: IS-normalized MF between 0.85 and 1.15

### 6.6 Extraction Recovery
- Compare pre-extraction spike vs post-extraction spike
- Test at 3 QC levels in triplicate
- Acceptance criteria: Recovery ≥ 60%, consistent across levels (CV ≤ 15%)

### 6.7 Carryover (CLSI C62-A)
- Inject ULOQ sample followed by 3 blank injections
- Acceptance criteria: Carryover in blank ≤ 20% of LLOQ signal

### 6.8 Stability
- Bench-top stability: 4h at room temperature
- Freeze-thaw stability: 3 cycles at -20°C or -80°C
- Long-term stability: at expected storage temperature
- Processed sample stability: in autosampler at 4-8°C, 24h
- Acceptance criteria: Within ±15% of nominal concentration

## 7. ACCEPTANCE CRITERIA SUMMARY TABLE
| Parameter | Acceptance Criteria | CLSI Reference |
|-----------|--------------------|-----------------| 
| Calibration r² | ≥ 0.995 | EP6 |
| LLOQ CV | ≤ 20% | EP17-A2 |
| LLOQ Bias | ≤ ±20% | EP17-A2 |
| QC CV (intra) | ≤ 15% | EP15-A3 |
| QC CV (inter) | ≤ 15% | EP15-A3 |
| Trueness | ≤ ±15% | EP15-A3 |
| Matrix factor (IS-norm) | 0.85 - 1.15 | C62-A |
| Extraction recovery | ≥ 60%, CV ≤15% | C62-A |
| Carryover | ≤ 20% LLOQ | C62-A |

## 8. DATA ANALYSIS AND CALCULATIONS
[Provide actual formulas for CV%, bias%, matrix factor, recovery calculation]

## 9. DOCUMENTATION AND RECORDS
[List what to document]

## 10. REFERENCES
- CLSI EP17-A2: Protocols for Determination of Limits of Detection and Limits of Quantitation
- CLSI EP15-A3: User Verification of Precision and Estimation of Bias
- CLSI C62-A: Liquid Chromatography-Mass Spectrometry Methods
- Method source: MetaboLC Repository, Method ID {method.id}

Be very specific with numbers — calculate actual QC concentrations, calibrator levels, and volumes based on the method parameters provided. Make it a true "cookbook" that a lab scientist can follow without interpretation."""


@router.post("/methods/generate-sop")
def generate_sop_custom(payload: dict, db: Session = Depends(get_db)):
    import os
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="AI features not available in this deployment")
    from dotenv import load_dotenv
    load_dotenv('/Users/ilciequinteroavila/MetaboLC-app/.env')

    method_id = payload.get("method_id")
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")

    transitions = db.query(MRMTransition).filter(
        MRMTransition.method_id == method_id
    ).order_by(MRMTransition.is_internal_standard, MRMTransition.retention_time_min).all()

    quantifiers = [t for t in transitions if t.is_quantifier and not t.is_internal_standard]
    is_trans = [t for t in transitions if t.is_internal_standard]

    trans_text = "\n".join([
        f"| {t.compound_name} | {t.precursor_mz} | {t.product_mz} | {t.collision_energy_ev or 'N/A'} | {getattr(t,'declustering_potential',None) or 'N/A'} | {t.retention_time_min or 'N/A'} |"
        for t in quantifiers[:15]
    ])

    is_text = "\n".join([
        f"| {t.compound_name} | {t.precursor_mz} | {t.product_mz} | {t.collision_energy_ev or 'N/A'} |"
        for t in is_trans[:5]
    ])

    lloq = payload.get("lloq_override") or method.lloq or "Not specified"
    uloq = payload.get("uloq_override") or method.uloq or "Not specified"
    unit = getattr(method, "lloq_unit", "ng/mL") or "ng/mL"
    guidelines = ", ".join(payload.get("guidelines", ["CLSI EP15-A3", "CLSI EP17-A2", "CLSI C62-A"]))
    experiments = "\n".join([f"- {e}" for e in payload.get("experiments", [])])
    n_days = payload.get("n_days", 5)
    n_rep = payload.get("n_replicates", 5)
    n_qc = payload.get("n_qc_levels", 3)
    n_lots = payload.get("n_matrix_lots", 6)
    language = payload.get("language", "English")
    author = payload.get("author", "Not specified")
    reviewer = payload.get("reviewer", "Not specified")
    institution = payload.get("institution", "Not specified")
    version = payload.get("version", "1.0")
    notes = payload.get("additional_notes", "")

    prompt = f"""You are a senior LC-MS/MS validation specialist and QA Director. Generate a complete, professional validation SOP in {language} in Markdown format.

METHOD INFORMATION:
- Title: {method.title}
- Analytes: {method.analyte}
- Matrix: {method.matrix}
- Instrument: {method.instrument_manufacturer} {method.instrument_model}
- Ionization: {method.ionization_mode}
- Column: {method.column_name or 'Not specified'} {f"{method.column_length_mm}x{method.column_diameter_mm}mm {method.column_particle_size_um}µm" if method.column_length_mm else ''}
- Mobile Phase A: {method.mobile_phase_a or 'Not specified'}
- Mobile Phase B: {method.mobile_phase_b or 'Not specified'}
- Gradient: see transitions
- Flow rate: {getattr(method, 'flow_rate_ml_min', None) or 'Not specified'}
- Injection volume: {method.injection_volume_ul or 'Not specified'} µL
- Column temperature: {method.column_temperature_c or 'Not specified'} °C
- Sample preparation: {method.sample_prep_method or 'Not specified'}
- Sample prep details: {method.sample_prep_details or 'Not specified'}
- LLOQ: {lloq} {unit}
- ULOQ: {uloq} {unit}
- Source temp: {method.source_temperature_c or 'Not specified'} °C
- Ion spray voltage: {method.ion_spray_voltage or getattr(method, 'capillary_voltage_v', None) or 'Not specified'} V

MRM TRANSITIONS (Quantifiers):
| Compound | Q1 (m/z) | Q3 (m/z) | CE (eV) | DP (V) | RT (min) |
|----------|----------|----------|---------|--------|----------|
{trans_text}

INTERNAL STANDARDS:
| Compound | Q1 (m/z) | Q3 (m/z) | CE (eV) |
|----------|----------|----------|---------|
{is_text}

DOCUMENT CONTROL:
- Author: {author}
- Reviewer: {reviewer}
- Institution: {institution}
- Version: {version}
- Guidelines: {guidelines}

STUDY DESIGN:
- Validation days: {n_days}
- Replicates per day: {n_rep}
- QC levels: {n_qc}
- Matrix lots for matrix effects: {n_lots}

EXPERIMENTS TO INCLUDE:
{experiments}

ADDITIONAL NOTES: {notes or 'None'}

Generate the COMPLETE SOP with ALL sections fully written. Use Markdown formatting with tables. Be extremely specific — include exact volumes, concentrations, sequences of injections, and acceptance criteria. Calculate QC concentrations based on LLOQ and ULOQ. Include day-by-day schedule table.

Structure:
# [Method Title] — Validation Protocol SOP
## Document Control Table
## 1. Purpose and Scope
## 2. Equipment and Reagents
### 2.1 Equipment list (table)
### 2.2 Reagents and solvents (table with supplier, purity, storage)
### 2.3 Mobile phase preparation (step by step)
### 2.4 Stock and working solution preparation (with exact concentrations)
### 2.5 QC preparation (table with levels: QC-LLOQ, QC-Low, QC-Mid, QC-High, QC-ULOQ)
## 3. Sample Preparation Protocol (numbered steps, exact volumes)
## 4. Chromatographic Conditions (table)
## 5. MS/MS Parameters (source table + MRM transitions table)
## 6. Validation Experiments
### 6.1 Calibration Curve (levels, replicates, acceptance criteria)
### 6.2 LLOQ/LOD Verification — CLSI EP17-A2 (exact injection sequence)
### 6.3 Intra-day Precision — Day 1 (exact sequence: Blank → Calibrators → QCs)
### 6.4 Inter-day Precision — Days 1-{n_days} (design table)
### 6.5 Matrix Effects — {n_lots} matrix lots (post-extraction spike protocol)
### 6.6 Extraction Recovery (pre vs post-extraction spike)
### 6.7 Carryover (ULOQ → 3 blanks sequence)
### 6.8 Stability studies (bench-top, freeze-thaw, long-term, autosampler)
## 7. Day-by-Day Validation Schedule (table: Day 1 to Day {n_days})
## 8. Acceptance Criteria Summary Table
## 9. Data Analysis and Statistical Calculations (formulas)
## 10. References"""

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        messages=[{{"role": "user", "content": prompt}}]
    )

    return {{"sop": response.content[0].text}}


@router.get("/methods/{method_id}/export/sop")
def generate_sop(method_id: int, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")

    transitions = db.query(MRMTransition).filter(
        MRMTransition.method_id == method_id
    ).order_by(
        MRMTransition.is_internal_standard,
        MRMTransition.retention_time_min
    ).all()

    prompt = build_sop_prompt(method, transitions)

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )

    sop_content = response.content[0].text
    filename = f"SOP_Validation_{method_id}_{(method.analyte or 'method')[:30].replace(' ','_').replace(',','')}.md"

    return Response(
        content=sop_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
