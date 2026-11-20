"""Panel builder: put analytes together from the library's transitions.

GET  /api/tools/panel/options?key=...    every transition the library holds for one analyte,
                                         grouped by (Q1, Q3, polarity), with the methods it comes from.
POST /api/tools/panel/export/{fmt_key}   the panel as a transition table, in the same formats as a
                                         method export (Skyline, vendor tables, generic).

No chromatography on purpose: transitions taken from different methods do not share a column or a
gradient, so retention times are never combined. Isobaric conflicts and dwell times are worked out
in the browser from the m/z values alone.
"""
from collections import Counter
from types import SimpleNamespace
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.exports import FORMATS, render_rows, Row, parent_analyte
from backend.models import Method, MRMTransition
from backend.rate_limit import rate_limit
from backend.visibility import PUBLIC_STATUSES

router = APIRouter()
MERGE_TOL = 0.3  # m/z


def _key(name: Optional[str], cid: Optional[int]) -> str:
    """Same analyte key as GET /api/methods/compounds."""
    return str(cid) if (cid and cid > 0) else (name or "").strip().lower()


def _sign(t_polarity: Optional[str], method_mode: Optional[str]) -> str:
    mode = (method_mode or "").lower()
    single = not ("switch" in mode or "+/" in mode or "±" in mode)
    if single and mode:
        return "-" if ("-" in mode or "neg" in mode) else "+"
    return "-" if (t_polarity or "").endswith("-") else "+"


@router.get("/tools/panel/options")
def panel_options(key: str = Query(..., min_length=1, max_length=200),
                  name: Optional[str] = Query(None, max_length=200),
                  db: Session = Depends(get_db)):
    """Distinct transitions for one analyte across public methods, most used first.

    Some transitions of an analyte have a PubChem CID and some do not, so the analyte index can list
    it twice. Passing its name as well as its key brings both together."""
    q = (db.query(MRMTransition, Method.id, Method.title, Method.status, Method.ionization_mode,
                  Method.instrument_manufacturer)
           .join(Method, Method.id == MRMTransition.method_id)
           .filter(Method.status.in_(PUBLIC_STATUSES), MRMTransition.is_internal_standard == 0,
                   MRMTransition.precursor_mz.isnot(None), MRMTransition.product_mz.isnot(None)))
    from sqlalchemy import func, or_
    by_name = func.lower(func.trim(MRMTransition.compound_name))
    names = {n.strip().lower() for n in (name, None if key.isdigit() else key) if n and n.strip()}
    conds = [by_name.in_(names)] if names else []
    if key.isdigit():
        conds.append(MRMTransition.pubchem_cid == int(key))
    q = q.filter(or_(*conds))
    rows = q.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No transitions for this analyte.")

    # Sources round m/z differently (768.4 / 768.5 / 768.6): transitions within MERGE_TOL of a
    # group's average, same polarity, are the same transition.
    clusters: list = []  # [mean q1, mean q3, polarity, items]
    names = Counter()
    for t, mid, title, status, mode, vendor in sorted(rows, key=lambda r: (r[0].precursor_mz, r[0].product_mz)):
        names[(t.compound_name or "").strip()] += 1
        pol, q1, q3 = _sign(t.polarity, mode), float(t.precursor_mz), float(t.product_mz)
        for c in clusters:
            if c[2] == pol and abs(c[0] - q1) <= MERGE_TOL + 1e-6 and abs(c[1] - q3) <= MERGE_TOL + 1e-6:
                c[3].append((t, mid, title, status, vendor))
                n = len(c[3])
                c[0] += (q1 - c[0]) / n
                c[1] += (q3 - c[1]) / n
                break
        else:
            clusters.append([q1, q3, pol, [(t, mid, title, status, vendor)]])

    options = []
    for _, _, pol, items in clusters:
        # Report the value most sources use
        q1 = Counter(round(float(t.precursor_mz), 1) for t, *_ in items).most_common(1)[0][0]
        q3 = Counter(round(float(t.product_mz), 1) for t, *_ in items).most_common(1)[0][0]
        methods = {}
        for t, mid, title, status, vendor in items:
            methods.setdefault(mid, (title, status, vendor))
        quant_votes = sum(1 for t, *_ in items if t.is_quantifier)
        ces = Counter(round(float(t.collision_energy_ev), 1) for t, *_ in items if t.collision_energy_ev is not None)
        # Prefer a verified method as the example source for the voltages
        src_t, src_mid = sorted(items, key=lambda it: (it[3] != "verified", it[1]))[0][:2]
        options.append({
            "q1": q1, "q3": q3, "polarity": pol,
            "role": "Quant" if quant_votes * 2 >= len(items) else "Qual",
            "method_count": len(methods),
            "verified_count": sum(1 for _, s, _ in methods.values() if s == "verified"),
            "collision_energies": [ce for ce, _ in ces.most_common()],
            "source": {
                "method_id": src_mid,
                "ce": src_t.collision_energy_ev, "cone_voltage": src_t.cone_voltage,
                "declustering_potential": src_t.declustering_potential, "cell_exit_potential": src_t.cell_exit_potential,
            },
            "methods": [{"id": mid, "title": title, "status": status, "vendor": vendor}
                        for mid, (title, status, vendor) in sorted(methods.items(), key=lambda kv: kv[1][1] != "verified")][:6],
        })
    options.sort(key=lambda o: (o["role"] != "Quant", -o["method_count"], -o["verified_count"]))
    return {"key": key, "name": names.most_common(1)[0][0], "options": options}


class PanelRow(BaseModel):
    compound: str = Field(..., min_length=1, max_length=200)
    role: str = Field(..., pattern="^(Quant|Qual|IS)$")
    polarity: str = Field(..., pattern=r"^[+-]$")
    q1: float = Field(..., gt=0, lt=5000)
    q3: float = Field(..., gt=0, lt=5000)
    ce: Optional[float] = None
    cone_voltage: Optional[float] = None
    declustering_potential: Optional[float] = None
    cell_exit_potential: Optional[float] = None
    dwell_ms: Optional[float] = Field(None, ge=0, le=10000)


class PanelExport(BaseModel):
    name: str = Field("Koiné panel", max_length=60)
    rows: List[PanelRow] = Field(..., min_length=1, max_length=1000)


@router.post("/tools/panel/export/{fmt_key}",
             dependencies=[Depends(rate_limit("panel_export", max_calls=60, window_seconds=3600))])
def panel_export(fmt_key: str, body: PanelExport):
    fmt = FORMATS.get(fmt_key)
    if not fmt:
        raise HTTPException(status_code=404, detail="Unknown export format.")
    rows = []
    for r in body.rows:
        t = SimpleNamespace(
            precursor_mz=r.q1, product_mz=r.q3, collision_energy_ev=r.ce, dwell_time_ms=r.dwell_ms,
            cone_voltage=r.cone_voltage, declustering_potential=r.declustering_potential,
            cell_exit_potential=r.cell_exit_potential,
            # No chromatography in a panel: retention times are never carried over.
            retention_time_min=None, retention_time_window_min=None,
            rf_lens_v=None, cell_accelerator_voltage=None, q1_pre_bias=None, q3_pre_bias=None,
            assigned_is=None, ms_resolution=None,
        )
        rows.append(Row(compound=r.compound, role=r.role, polarity=r.polarity, t=t, molecule=r.compound))
    analytes = {row.compound.lower(): row.compound for row in rows if row.role != "IS"}
    for row in rows:
        if row.role == "IS":
            parent = parent_analyte(row.compound, analytes)
            if parent and parent.lower() != row.compound.lower():
                row.molecule, row.label = parent, "heavy"
    content = render_rows(fmt, rows, body.name or "Koiné panel")
    safe = "".join(ch if ch.isalnum() else "_" for ch in (body.name or "panel"))[:40].strip("_") or "panel"
    media = "text/tab-separated-values" if fmt.delimiter == "\t" else "text/csv"
    # BOM so Excel opens accents and µ correctly, as in a method export.
    return Response(content="\ufeff" + content, media_type=f"{media}; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="Koine_panel_{safe}_{fmt.key}.{fmt.extension}"'})
