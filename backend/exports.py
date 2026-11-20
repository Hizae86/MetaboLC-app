"""Transition-table exports for instrument software.

MetaboLC does not write native acquisition methods (.meth, .m, .lcm, .dam...):
those are closed, version-dependent formats. It writes the transition table
that each software can import or paste into its method editor, plus a
Skyline transition list, from which Skyline can build native methods with a
template of the user's own instrument.

Rules every format follows:
  * Only stored values are written. A missing CE, DP, cone voltage, dwell or
    RT window is left blank, never filled with a default.
  * Polarity comes from the method when it runs in a single polarity (the
    per-transition field defaulted to ESI+ in older records); per-transition
    polarity is used only for polarity-switching methods.

Verification status. Each format records where it has been confirmed to
import cleanly. Nothing is marked as tested until someone has imported a
real export into that software; see docs/EXPORT_FORMATS.md.
  documented  column names taken from the software's public documentation
  untested    column names follow the vendor's terminology, not yet checked
              against a real import
"""
import csv
import io
import re
from dataclasses import dataclass, field
from typing import Callable, List, Optional


@dataclass
class Column:
    header: str
    value: Callable[["Row"], object]


@dataclass
class ExportFormat:
    key: str
    label: str
    software: str
    extension: str
    status: str                      # "documented" | "untested"
    tested_in: Optional[str] = None  # e.g. "Skyline 24.1" once confirmed
    delimiter: str = ","
    vendor: Optional[str] = None     # manufacturer whose instruments use it
    note: str = ""
    columns: List[Column] = field(default_factory=list)
    reference: Optional[str] = None  # where the column names come from


@dataclass
class Row:
    compound: str
    role: str            # "Quant" | "Qual" | "IS"
    polarity: str        # "+" | "-"
    t: object            # the MRMTransition
    molecule: str = ""   # Skyline: analyte a labelled IS belongs to
    label: str = "light"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _num(v) -> str:
    if v is None or v == "":
        return ""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    return str(int(f)) if f.is_integer() else f"{f:.4f}".rstrip("0").rstrip(".")


_LABEL = re.compile(r"[\s\-_,]*[\(\[]?\s*(d\d{1,2}|13c\d*|15n\d*|2h\d*|is|istd)\s*[\)\],]?\s*$", re.I)


def _strip_label(name: str) -> str:
    previous = None
    while previous != name:
        previous, name = name, _LABEL.sub("", name).strip()
    return name


def parent_analyte(name: str, analytes: dict) -> Optional[str]:
    """The analyte a labelled internal standard belongs to, or None.

    Labels are removed one at a time ("Tacrolimus-13C,d2" → "Tacrolimus-13C" → "Tacrolimus") and the
    first name that is an analyte of the list wins, so "25-OH Vitamin D3-d6" stops at
    "25-OH Vitamin D3" instead of also losing the "D3". `analytes` maps lower-case name → name.
    """
    previous, current = None, name.strip()
    while previous != current:
        if previous is not None and current.lower() in analytes:
            return analytes[current.lower()]
        previous, current = current, _LABEL.sub("", current).strip()
    return None


def _single_polarity(method) -> Optional[str]:
    mode = (method.ionization_mode or "").lower()
    if "switch" in mode or "+/" in mode or "±" in mode:
        return None
    if "-" in mode or "neg" in mode:
        return "-"
    return "+"


def build_rows(method) -> List[Row]:
    fixed = _single_polarity(method)
    analytes = {(t.compound_name or "").strip().lower(): (t.compound_name or "").strip()
                for t in method.mrm_transitions if not t.is_internal_standard}
    rows = []
    for t in method.mrm_transitions:
        name = (t.compound_name or "").strip()
        if not name or t.precursor_mz is None or t.product_mz is None:
            continue
        polarity = fixed or ("-" if (t.polarity or "").endswith("-") else "+")
        role = "IS" if t.is_internal_standard else ("Quant" if t.is_quantifier else "Qual")
        row = Row(compound=name, role=role, polarity=polarity, t=t, molecule=name)
        if t.is_internal_standard:
            # A labelled copy of an analyte ("Cortisol-d4") becomes that analyte's
            # heavy form in Skyline; a different molecule used as IS stays separate.
            parent = parent_analyte(name, analytes)
            if parent and parent.lower() != name.lower():
                row.molecule, row.label = parent, "heavy"
        rows.append(row)
    rt = lambda r: r.t.retention_time_min if r.t.retention_time_min is not None else float("inf")
    rows.sort(key=lambda r: (rt(r), r.molecule.lower(), r.role == "IS", r.role != "Quant"))
    return rows


def _list_name(method) -> str:
    return (method.analyte_normalized or method.clinical_application or method.title or f"Method {method.id}")[:60]


# Shared column builders
q1 = lambda h="Precursor m/z": Column(h, lambda r: _num(r.t.precursor_mz))
q3 = lambda h="Product m/z": Column(h, lambda r: _num(r.t.product_mz))
ce = lambda h: Column(h, lambda r: _num(r.t.collision_energy_ev))
rt = lambda h: Column(h, lambda r: _num(r.t.retention_time_min))
rtw = lambda h: Column(h, lambda r: _num(r.t.retention_time_window_min))
dwell = lambda h: Column(h, lambda r: _num(r.t.dwell_time_ms))
compound = lambda h: Column(h, lambda r: r.compound)
role = lambda h: Column(h, lambda r: r.role)
istd_flag = lambda h: Column(h, lambda r: "TRUE" if r.role == "IS" else "FALSE")
assigned_is = lambda h: Column(h, lambda r: r.t.assigned_is or "")
pol_word = lambda h: Column(h, lambda r: "Positive" if r.polarity == "+" else "Negative")


FORMATS = {
    "skyline": ExportFormat(
        key="skyline", label="Skyline transition list", software="Skyline", extension="csv",
        status="documented",
        reference="Skyline small-molecule tutorials (skyline.ms): column names recognised by Edit > Insert > Transition List",
        note="Paste or import in Skyline (Edit > Insert > Transition List, small molecules). "
             "Skyline can then export a native method for your instrument from a template.",
        columns=[
            Column("Molecule List Name", lambda r: r.method_list_name),
            Column("Molecule Name", lambda r: r.molecule),
            Column("Label Type", lambda r: r.label),
            q1("Precursor m/z"),
            Column("Precursor Charge", lambda r: "1" if r.polarity == "+" else "-1"),
            q3("Product m/z"),
            Column("Product Charge", lambda r: "1" if r.polarity == "+" else "-1"),
            ce("Explicit Collision Energy"),
            Column("Cone Voltage", lambda r: _num(r.t.cone_voltage)),
            rt("Explicit Retention Time"),
            rtw("Explicit Retention Time Window"),
        ],
    ),
    "sciex": ExportFormat(
        key="sciex", label="SCIEX MRM table", software="SCIEX OS / Analyst", extension="txt",
        status="untested", vendor="Sciex", delimiter="\t",
        note="Tab-separated MRM table to paste or import in the MS method editor.",
        columns=[q1("Q1"), q3("Q3"), dwell("Dwell time (ms)"), compound("ID"),
                 Column("DP", lambda r: _num(r.t.declustering_potential)), ce("CE"),
                 Column("CXP", lambda r: _num(r.t.cell_exit_potential)), rt("RT (min)"), rtw("RT window (min)"),
                 pol_word("Polarity"), role("Role")],
    ),
    "waters": ExportFormat(
        key="waters", label="Waters MRM table", software="MassLynx / waters_connect", extension="csv",
        status="untested", vendor="Waters",
        note="MRM functions table for the MS method editor or Quanpedia.",
        columns=[compound("Compound"), q1("Parent (m/z)"), q3("Daughter (m/z)"),
                 Column("Cone (V)", lambda r: _num(r.t.cone_voltage)), ce("Collision (eV)"),
                 dwell("Dwell (ms)"), rt("RT (min)"), rtw("RT window (min)"),
                 Column("Ionization mode", lambda r: "ES+" if r.polarity == "+" else "ES-"), role("Role")],
    ),
    "thermo": ExportFormat(
        key="thermo", label="Thermo SRM table", software="TSQ method editor / TraceFinder", extension="csv",
        status="untested", vendor="Thermo Fisher",
        note="SRM table for the TSQ method editor (paste) or a TraceFinder compound database.",
        columns=[compound("Compound"), rt("Retention Time (min)"), rtw("RT Window (min)"), pol_word("Polarity"),
                 q1("Precursor (m/z)"), q3("Product (m/z)"), ce("Collision Energy (V)"),
                 Column("RF Lens (V)", lambda r: _num(r.t.rf_lens_v)), role("Role")],
    ),
    "agilent": ExportFormat(
        key="agilent", label="Agilent dMRM table", software="MassHunter Acquisition", extension="csv",
        status="untested", vendor="Agilent",
        note="dMRM / MRM table to paste in the MassHunter acquisition method editor.",
        columns=[compound("Compound Name"), istd_flag("ISTD?"), q1("Precursor Ion"), q3("Product Ion"),
                 Column("Fragmentor", lambda r: _num(r.t.declustering_potential)), ce("Collision Energy"),
                 Column("Cell Accelerator Voltage", lambda r: _num(r.t.cell_accelerator_voltage)),
                 rt("Ret Time (min)"), rtw("Delta Ret Time"), pol_word("Polarity"), role("Role")],
    ),
    "shimadzu": ExportFormat(
        key="shimadzu", label="Shimadzu MRM table", software="LabSolutions", extension="csv",
        status="untested", vendor="Shimadzu",
        note="MRM event table for the LabSolutions method editor.",
        columns=[compound("Compound Name"), q1("Precursor m/z"), q3("Product m/z"),
                 Column("Q1 Pre Bias (V)", lambda r: _num(r.t.q1_pre_bias)), ce("CE (V)"),
                 Column("Q3 Pre Bias (V)", lambda r: _num(r.t.q3_pre_bias)), dwell("Dwell Time (msec)"),
                 rt("Retention Time (min)"), rtw("RT Window (min)"),
                 Column("Polarity", lambda r: r.polarity), role("Role")],
    ),
    "generic": ExportFormat(
        key="generic", label="All transition fields", software="Excel / any software", extension="csv",
        status="documented",
        note="Every stored transition field, one row per transition. For your own spreadsheets and conversions.",
        columns=[compound("Compound"), role("Role"), assigned_is("Internal standard"), q1("Q1 (m/z)"), q3("Q3 (m/z)"),
                 rt("RT (min)"), rtw("RT window (min)"), ce("CE (eV)"),
                 Column("DP (V)", lambda r: _num(r.t.declustering_potential)),
                 Column("CXP (V)", lambda r: _num(r.t.cell_exit_potential)),
                 Column("Cone (V)", lambda r: _num(r.t.cone_voltage)),
                 Column("Cell accelerator (V)", lambda r: _num(r.t.cell_accelerator_voltage)),
                 Column("Q1 pre-bias (V)", lambda r: _num(r.t.q1_pre_bias)),
                 Column("Q3 pre-bias (V)", lambda r: _num(r.t.q3_pre_bias)),
                 Column("RF lens (V)", lambda r: _num(r.t.rf_lens_v)),
                 Column("Resolution", lambda r: r.t.ms_resolution or ""),
                 dwell("Dwell (ms)"), Column("Polarity", lambda r: "ESI" + r.polarity)],
    ),
}


def render(fmt: ExportFormat, method) -> str:
    return render_rows(fmt, build_rows(method), _list_name(method))


def render_rows(fmt: ExportFormat, rows: List[Row], list_name: str) -> str:
    """Writes rows in a format. Used for a method and for a panel from the panel builder."""
    for r in rows:
        r.method_list_name = list_name  # type: ignore[attr-defined]
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=fmt.delimiter, lineterminator="\r\n")
    writer.writerow([c.header for c in fmt.columns])
    for r in rows:
        writer.writerow([c.value(r) for c in fmt.columns])
    return buf.getvalue()


def filename(fmt: ExportFormat, method) -> str:
    base = re.sub(r"[^A-Za-z0-9]+", "_", method.analyte_normalized or method.analyte or "method").strip("_")[:40]
    return f"Koine_{method.id}_{base}_{fmt.key}.{fmt.extension}"


def describe(fmt: ExportFormat) -> dict:
    return {
        "key": fmt.key, "label": fmt.label, "software": fmt.software, "extension": fmt.extension,
        "status": fmt.status, "tested_in": fmt.tested_in, "vendor": fmt.vendor, "note": fmt.note,
        "columns": [c.header for c in fmt.columns],
    }
