"""Server-side search, faceting and autocomplete for the method catalogue.

Why this exists: the browse page used to download every method and filter
in the browser, which meant it could not search MRM transitions (the summary
payload has none), stationary phases or mobile phases.

How it works: the catalogue is small and read-mostly, so it is flattened once
into an in-memory index (one dict per method, including its transitions) and
re-used across requests. The index is rebuilt when the row counts or the
latest `updated_at` change, and at most every INDEX_TTL_SECONDS regardless,
so edits show up without a restart. Everything here is plain SQLAlchemy and
behaves the same on SQLite and PostgreSQL.
"""
import re
import time
from collections import Counter
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.models import Method, MRMTransition
from backend.completeness import calc_completeness
from backend import community
from backend.visibility import PUBLIC_STATUSES

router = APIRouter()

INDEX_TTL_SECONDS = 30
DEFAULT_MZ_TOLERANCE = 0.5

# ── Normalisation ────────────────────────────────────────────────────────────

_ORGANIC = [
    ("Methanol", r"\b(methanol|meoh)\b"),
    ("Acetonitrile", r"\b(acetonitrile|acn|mecn)\b"),
    ("Isopropanol", r"\b(isopropanol|2-propanol|ipa)\b"),
]
_ADDITIVES = [
    ("Formic acid", r"\bformic\b"),
    ("Acetic acid", r"\bacetic\b"),
    ("Ammonium formate", r"\bammonium formate\b"),
    ("Ammonium acetate", r"\bammonium acetate\b"),
    ("Ammonium fluoride", r"\bammonium fluoride\b"),
    ("Ammonium hydroxide", r"\b(ammonium hydroxide|ammonia|nh4oh)\b"),
    ("Ammonium bicarbonate", r"\bammonium bicarbonate\b"),
    ("TFA", r"\b(tfa|trifluoroacetic)\b"),
]
_MATRIX_LABELS = {"csf": "CSF", "dried blood spot": "Dried blood spot"}


def _key(value: Optional[str]) -> str:
    return " ".join((value or "").split()).casefold()


def _prep_key(value: Optional[str]) -> str:
    # "Protein Precipitation (PPT)" and "Protein precipitation" are one facet.
    return _key(re.sub(r"\s*\([^)]*\)\s*$", "", value or ""))


def _ionization_label(value: Optional[str]) -> Optional[str]:
    v = (value or "").strip()
    if not v:
        return None
    low = v.lower()
    if "switch" in low or "+/" in v:
        return "ESI ±"
    return v.split(" ")[0]


def _detect(patterns, text: str) -> List[str]:
    return [label for label, rx in patterns if re.search(rx, text, re.I)]


# ── Index ────────────────────────────────────────────────────────────────────

_index = {"built_at": 0.0, "signature": None, "rows": []}


def _signature(db: Session):
    # Status is part of the signature: publishing or rejecting a method must refresh the index.
    return (
        db.query(func.count(Method.id)).scalar(),
        db.query(func.max(Method.updated_at)).scalar(),
        db.query(func.count(Method.id)).filter(Method.status.in_(PUBLIC_STATUSES)).scalar(),
        db.query(func.count(MRMTransition.id)).scalar(),
        db.query(func.max(MRMTransition.id)).scalar(),
    )


def _build_row(m: Method) -> dict:
    transitions = [
        {
            "compound": (t.compound_name or "").strip(),
            "precursor_mz": t.precursor_mz,
            "product_mz": t.product_mz,
            "is_is": bool(t.is_internal_standard),
            "is_quantifier": bool(t.is_quantifier),
        }
        for t in m.mrm_transitions
    ]
    compounds = sorted({t["compound"] for t in transitions if t["compound"] and not t["is_is"]})
    mobile = f"{m.mobile_phase_a or ''} | {m.mobile_phase_b or ''}"
    steps = sorted(m.gradient_steps, key=lambda s: s.time_min)
    row = {
        "id": m.id,
        "title": m.title,
        "analyte": m.analyte,
        "matrix": m.matrix,
        "clinical_application": m.clinical_application,
        "ionization_mode": m.ionization_mode,
        "instrument_manufacturer": m.instrument_manufacturer,
        "instrument_model": m.instrument_model,
        "column_brand": m.column_brand,
        "column_name": m.column_name,
        "column_stationary_phase": m.column_stationary_phase,
        "mobile_phase_a": m.mobile_phase_a,
        "mobile_phase_b": m.mobile_phase_b,
        "sample_prep_method": m.sample_prep_method,
        "lloq": m.lloq,
        "lloq_unit": m.lloq_unit,
        "laboratory": m.laboratory,
        "country": m.country,
        "source_type": m.source_type,
        "status": m.status,
        "is_derivatized": bool(m.is_derivatized),
        "run_time_min": steps[-1].time_min if steps else None,
        "mrm_count": len(transitions),
        "compound_count": len(compounds),
        "completeness_score": calc_completeness(m),
        "chromatogram_svg": m.chromatogram_svg,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
    row["_compounds"] = compounds
    row["_transitions"] = transitions
    row["_facets"] = {
        "matrix": [_key(m.matrix)] if m.matrix else [],
        "vendor": [_key(m.instrument_manufacturer)] if m.instrument_manufacturer else [],
        "phase": [_key(m.column_stationary_phase)] if m.column_stationary_phase else [],
        "organic": [_key(x) for x in _detect(_ORGANIC, m.mobile_phase_b or "")],
        "additive": [_key(x) for x in _detect(_ADDITIVES, mobile)],
        "prep": [_prep_key(m.sample_prep_method)] if m.sample_prep_method else [],
        "ionization": [_key(_ionization_label(m.ionization_mode))] if m.ionization_mode else [],
        "application": [_key(m.clinical_application)] if m.clinical_application else [],
    }
    row["_labels"] = {
        "matrix": _MATRIX_LABELS.get(_key(m.matrix), (m.matrix or "").strip().capitalize()),
        "vendor": m.instrument_manufacturer,
        "phase": m.column_stationary_phase,
        "prep": re.sub(r"\s*\([^)]*\)\s*$", "", m.sample_prep_method or "").strip(),
        "ionization": _ionization_label(m.ionization_mode),
        "application": m.clinical_application,
    }
    row["_primary"] = _key(f"{m.analyte or ''} {' '.join(compounds)}")
    row["_blob"] = _key(" ".join(str(x) for x in [
        m.title, m.analyte, m.matrix, m.clinical_application, m.instrument_manufacturer,
        m.instrument_model, m.column_brand, m.column_name, m.column_stationary_phase,
        mobile, m.sample_prep_method, m.laboratory, m.country, m.source_authors, m.reference,
        m.ionization_mode, " ".join(t["compound"] for t in transitions),
    ] if x))
    return row


def get_index(db: Session) -> List[dict]:
    now = time.time()
    fresh = now - _index["built_at"] < INDEX_TTL_SECONDS
    signature = _signature(db)
    if _index["rows"] and fresh and signature == _index["signature"]:
        return _index["rows"]
    methods = (
        db.query(Method)
        .filter(Method.status.in_(PUBLIC_STATUSES))
        .options(selectinload(Method.mrm_transitions), selectinload(Method.gradient_steps),
                 selectinload(Method.compound_validations))
        .all()
    )
    _index.update(built_at=now, signature=signature, rows=[_build_row(m) for m in methods])
    return _index["rows"]


# ── Matching ─────────────────────────────────────────────────────────────────

_NUMBER = re.compile(r"^\d+(\.\d+)?$")
FACET_KEYS = ["matrix", "vendor", "phase", "organic", "additive", "prep", "ionization", "application"]


def _mz_hits(row: dict, mz: float, tol: float) -> List[dict]:
    return [
        t for t in row["_transitions"]
        if abs((t["precursor_mz"] or -1e9) - mz) <= tol or abs((t["product_mz"] or -1e9) - mz) <= tol
    ]


def _match_query(row: dict, tokens: List[str], tol: float):
    """Returns (score, matched_transitions) or None when the row does not match."""
    score = 0
    hits: List[dict] = []
    for tok in tokens:
        in_text = tok in row["_blob"]
        mz = _mz_hits(row, float(tok), tol) if _NUMBER.match(tok) else []
        if not in_text and not mz:
            return None
        if mz:
            hits.extend(mz)
            score += 40
        if in_text:
            score += 10
            if tok in row["_primary"]:
                score += 30
            if any(c.casefold() == tok for c in row["_compounds"]) or _key(row["analyte"]) == tok:
                score += 40
            elif any(c.casefold().startswith(tok) for c in row["_compounds"]):
                score += 15
            hits.extend(t for t in row["_transitions"] if tok in t["compound"].casefold() and not t["is_is"])
    return score, hits


def _public(row: dict, hits: List[dict], thumbnails: bool) -> dict:
    out = {k: v for k, v in row.items() if not k.startswith("_")}
    if not thumbnails:
        # Cached chromatogram SVGs are ~20 kB each; only the card view needs them.
        out["chromatogram_svg"] = None
    seen, matched = set(), []
    for t in sorted(hits, key=lambda t: (not t["is_quantifier"], t["is_is"])):
        sig = (t["compound"], t["precursor_mz"], t["product_mz"])
        if sig in seen:
            continue
        seen.add(sig)
        matched.append({k: t[k] for k in ("compound", "precursor_mz", "product_mz", "is_is", "is_quantifier")})
        if len(matched) == 3:
            break
    out["matched_transitions"] = matched
    out["compounds_preview"] = row["_compounds"][:4]
    return out



def _with_community(db: Session, items: list[dict]) -> list[dict]:
    """Published community review counts for one page of results (not cached: they change often)."""
    counts = community.summaries(db, [it["id"] for it in items])
    for it in items:
        it["community"] = counts.get(it["id"])
    return items

@router.get("/search")
def search_methods(
    q: str = "",
    matrix: List[str] = Query(default=[]),
    vendor: List[str] = Query(default=[]),
    phase: List[str] = Query(default=[]),
    organic: List[str] = Query(default=[]),
    additive: List[str] = Query(default=[]),
    prep: List[str] = Query(default=[]),
    ionization: List[str] = Query(default=[]),
    application: List[str] = Query(default=[]),
    mz: Optional[float] = Query(default=None, description="Precursor or product m/z"),
    mz_tol: float = Query(default=DEFAULT_MZ_TOLERANCE, ge=0, le=5),
    verified: bool = False,
    derivatized: bool = False,
    sort: str = Query(default="relevance", pattern="^(relevance|completeness|recent|title)$"),
    thumbnails: bool = False,
    limit: int = Query(default=48, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    rows = get_index(db)
    tokens = [t for t in _key(q).split(" ") if t]
    selected = {
        "matrix": matrix, "vendor": vendor, "phase": phase, "organic": organic, "additive": additive,
        "prep": prep, "ionization": ionization, "application": application,
    }
    selected = {k: {_key(v) for v in vals if v} for k, vals in selected.items()}

    # 1. Text / m/z / toggles: everything that is not a facet.
    base = []
    for row in rows:
        if verified and row["status"] != "verified":
            continue
        if derivatized and not row["is_derivatized"]:
            continue
        matched = _match_query(row, tokens, mz_tol)
        if matched is None:
            continue
        score, hits = matched
        if mz is not None:
            mz_hits = _mz_hits(row, mz, mz_tol)
            if not mz_hits:
                continue
            hits = mz_hits + hits
        base.append((row, score, hits))

    def passes(row: dict, skip: Optional[str] = None) -> bool:
        return all(
            not wanted or key == skip or wanted.intersection(row["_facets"][key])
            for key, wanted in selected.items()
        )

    # 2. Facet counts: each group is counted with every *other* filter applied,
    #    so selecting "Plasma" still shows how many serum methods you'd get.
    facets = {}
    for key in FACET_KEYS:
        counts, labels = Counter(), {}
        for row, _, _ in base:
            if not passes(row, skip=key):
                continue
            for value in row["_facets"][key]:
                counts[value] += 1
                labels.setdefault(value, Counter())[row["_labels"].get(key) or value] += 1
        for value in selected[key]:
            counts.setdefault(value, 0)
        facets[key] = [
            {
                "value": value,
                "label": (labels[value].most_common(1)[0][0] if value in labels else value)
                if key not in ("organic", "additive")
                else next((lbl for lbl, _ in _ORGANIC + _ADDITIVES if _key(lbl) == value), value),
                "count": count,
            }
            for value, count in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ]

    # 3. Results.
    results = [(row, score, hits) for row, score, hits in base if passes(row)]
    if sort == "completeness":
        results.sort(key=lambda r: (-r[0]["completeness_score"], r[0]["title"] or ""))
    elif sort == "recent":
        results.sort(key=lambda r: r[0]["created_at"] or "", reverse=True)
    elif sort == "title":
        results.sort(key=lambda r: (r[0]["analyte"] or r[0]["title"] or "").casefold())
    else:
        results.sort(key=lambda r: (-r[1], r[0]["status"] != "verified", -r[0]["completeness_score"]))

    page = results[offset: offset + limit]
    return {
        "total": len(results),
        "catalogue_total": len(rows),
        "offset": offset,
        "limit": limit,
        "mz_tolerance": mz_tol,
        "items": _with_community(db, [_public(row, hits, thumbnails) for row, _, hits in page]),
        "facets": facets,
    }


@router.get("/suggest")
def suggest(q: str = "", limit: int = Query(default=8, ge=1, le=20), db: Session = Depends(get_db)):
    """Autocomplete: compounds first (the thing people actually type), then
    any filter value whose label matches, so a filter is one click away."""
    needle = _key(q)
    if not needle:
        return {"compounds": [], "filters": []}
    rows = get_index(db)

    compound_counts, compound_label = Counter(), {}
    for row in rows:
        for name in row["_compounds"]:
            k = name.casefold()
            if needle in k:
                compound_counts[k] += 1
                compound_label.setdefault(k, name)
    compounds = sorted(
        compound_counts.items(),
        key=lambda kv: (not kv[0].startswith(needle), -kv[1], len(kv[0])),
    )[:limit]

    filters, seen = [], set()
    for key in ("matrix", "vendor", "phase", "application", "prep", "organic", "additive"):
        counts, labels = Counter(), {}
        for row in rows:
            for value in row["_facets"][key]:
                if needle in value:
                    counts[value] += 1
                    labels.setdefault(value, row["_labels"].get(key) or value)
        for value, count in counts.most_common(3):
            if (key, value) not in seen:
                seen.add((key, value))
                label = next((lbl for lbl, _ in _ORGANIC + _ADDITIVES if _key(lbl) == value), labels[value])
                filters.append({"facet": key, "value": value, "label": label, "count": count})

    mz = None
    if _NUMBER.match(needle):
        n = sum(1 for row in rows if _mz_hits(row, float(needle), DEFAULT_MZ_TOLERANCE))
        mz = {"value": float(needle), "count": n, "tolerance": DEFAULT_MZ_TOLERANCE}

    return {
        "compounds": [{"name": compound_label[k], "count": c} for k, c in compounds],
        "filters": filters[:6],
        "mz": mz,
    }


@router.get("/transitions/match")
def match_transitions(
    q1: float = Query(..., description="Precursor m/z to check"),
    q3: Optional[float] = Query(None, description="Product m/z (optional)"),
    tol: float = Query(0.5, ge=0.01, le=2.0),
    exclude: Optional[int] = Query(None, description="Method id to leave out (the method you came from)"),
    db: Session = Depends(get_db),
):
    """Isobaric-interference lookup: every stored transition whose Q1 (and Q3,
    if given) falls within the tolerance. Only public methods."""
    from sqlalchemy import func
    q = (
        db.query(
            MRMTransition.compound_name,
            MRMTransition.is_internal_standard,
            MRMTransition.is_quantifier,
            MRMTransition.precursor_mz,
            MRMTransition.product_mz,
            MRMTransition.collision_energy_ev,
            MRMTransition.retention_time_min,
            MRMTransition.polarity,
            Method.id.label("method_id"),
            Method.title,
            Method.matrix,
            Method.status,
            Method.ionization_mode,
        )
        .join(Method, Method.id == MRMTransition.method_id)
        .filter(
            Method.status.in_(PUBLIC_STATUSES),
            MRMTransition.precursor_mz.isnot(None),
            func.abs(MRMTransition.precursor_mz - q1) <= tol,
        )
    )
    if q3 is not None:
        q = q.filter(MRMTransition.product_mz.isnot(None), func.abs(MRMTransition.product_mz - q3) <= tol)
    if exclude:
        q = q.filter(Method.id != exclude)
    rows = q.order_by(func.abs(MRMTransition.precursor_mz - q1)).limit(300).all()
    return [
        {
            "compound_name": r.compound_name,
            "is_internal_standard": bool(r.is_internal_standard),
            "is_quantifier": bool(r.is_quantifier),
            "precursor_mz": r.precursor_mz,
            "product_mz": r.product_mz,
            "collision_energy_ev": r.collision_energy_ev,
            "retention_time_min": r.retention_time_min,
            "polarity": r.polarity or r.ionization_mode,
            "method_id": r.method_id,
            "method_title": r.title,
            "matrix": r.matrix,
            "status": r.status,
        }
        for r in rows
    ]
