"""Batch 6c (2026-11-17): fully automated serum LC-MS/MS platform for inborn errors of
metabolism (25 organic acids, 8 amino acids, 21 acylcarnitines; Shimadzu LCMS-8050 +
CLAM-2030, 3-NPH derivatization). Transitions from the article's supplementary Excel
(Table S4) supplied by the user; method and validation from the main text (Tables 1-2),
two independent readings agreed. Sent to the review queue as "submitted".
Run once from the project root:  python -m backend.scripts.import_open_access_batch6c
"""
import re, sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import rng, worst_acc

# Table S4 as printed: ID, RT (min), polarity, precursor, quantification ion, reference ion, HMDB
S4 = [
 ["Arginine", 1.385, "ESI-", 308.1, 266.25, 137.1, "HMDB0000517"],
 ["13C6_Arginine", 1.385, "ESI-", 314, 271.25, 137.1, "-"],
 ["Glutamine", 2.3, "ESI+", 282.2, 114, 265.2, "HMDB0000641"],
 ["Citrulline", 2.424, "ESI-", 309.4, 266, 137, "HMDB0000904"],
 ["2H7_Citrulline", 2.424, "ESI-", 316.4, 273, 137, "-"],
 ["AC_C0", 2.504, "ESI+", 297.35, 238.1, 145.25, "HMDB0000062"],
 ["2H9_AC_C0", 2.504, "ESI+", 306.4, 238.2, "-", "-"],
 ["AC_C2", 5.082, "ESI+", 339.4, 220.3, 339.2, "HMDB0240773"],
 ["2H3_AC_C2", 5.082, "ESI+", 342.4, 220.3, "-", "-"],
 ["Valine", 5.131, "ESI+", 253.3, 138, 236, "HMDB0000883"],
 ["2H8_Valine", 5.131, "ESI+", 261.3, 138, 244, "-"],
 ["Tyrosine", 5.178, "ESI+", 317.3, 300.1, 138, "HMDB0000158"],
 ["13C6_Tyrosine", 5.178, "ESI+", 323.3, 306.1, 138, "-"],
 ["Methionine", 5.38, "ESI-", 283.2, 137, 235.1, "HMDB0000696"],
 ["2H3_Methionine", 5.38, "ESI-", 286.2, 137, 235.1, "-"],
 ["AC_C5OH", 5.455, "ESI+", 397.4, 220.2, 397.4, "HMDB0061189"],
 ["2H9_AC_C5OH", 5.455, "ESI+", 406.5, 220.2, "-", "-"],
 ["3-Hydroxypropionic acid", 5.472, "ESI-", 224.2, 194, 152, "HMDB0000700"],
 ["13C3_3-Hydroxypropionic acid", 5.472, "ESI-", 227.3, 196, 152, "-"],
 ["AC_C3", 5.557, "ESI+", 353.5, 220.3, 353.2, "HMDB0000824"],
 ["2H3_AC_C3", 5.557, "ESI+", 356.4, 220.3, "-", "-"],
 ["Leucine", 5.644, "ESI+", 267.3, 250.2, 138, "HMDB0000687"],
 ["2H3_Leucine", 5.644, "ESI+", 270.3, 253.2, 138, "-"],
 ["Orotic  acid", 5.748, "ESI-", 290.1, 150.1, 178.15, "HMDB0000226"],
 ["Lactic acid", 5.834, "ESI-", 224.2, 152.15, 137.1, "HMDB0000190"],
 ["13C3_Lactic acid", 5.834, "ESI-", 227.05, 152.15, 137.1, "-"],
 ["Phenylalanine", 5.86, "ESI+", 301.3, 138, 284, "HMDB0000159"],
 ["13C6_Phenylalanine", 5.86, "ESI+", 307.3, 138, 290, "-"],
 ["3-Hydroxybutyric acid", 5.89, "ESI-", 238.2, 152.15, 194.2, "HMDB0000011"],
 ["AC_C4", 5.92, "ESI+", 367.4, 220.3, 367.3, "HMDB0002013"],
 ["2H3_AC_C4", 5.92, "ESI+", 370.2, 220.3, "-", "-"],
 ["AC_C5:1", 6.014, "ESI+", 379.3, 220.1, 145.15, "HMDB0002366"],
 ["AC_C4DC", 6.138, "ESI+", 532.15, 220.15, 145.15, "HMDB0013133"],
 ["AC_C5DC", 6.183, "ESI+", 546.5, 220.2, 546.2, "HMDB0013130"],
 ["2H9_AC_C5DC", 6.183, "ESI+", 555.3, 220.2, "-", "-"],
 ["AC_C5", 6.213, "ESI+", 381.5, 220.1, 381.4, "HMDB0000688"],
 ["2H9_AC_C5", 6.213, "ESI+", 390.3, 220.1, "-", "-"],
 ["2-Methyl-3-hydroxybutyric acid", 6.265, "ESI-", 252.4, 208.1, 137, "HMDB0000354"],
 ["3-Hydroxyisovaleric acid", 6.373, "ESI-", 252.4, 194.05, 152, "HMDB0000754"],
 ["2H8_3-Hydroxyisovaleric acid", 6.373, "ESI-", 260.1, 196.25, 152, "-"],
 ["AC_C6", 6.605, "ESI+", 395.2, 220.1, 395.2, "HMDB0000756"],
 ["3-Methylcrotonylglycine", 6.945, "ESI-", 291.4, 209, 137, "HMDB0000459"],
 ["13C2_15N1_3_Methylcrotonylglycine", 6.945, "ESI-", 294.1, 212.1, 137, "-"],
 ["Tiglylglycine", 6.98, "ESI-", 291.2, 209.2, 137.15, "HMDB0000959"],
 ["Isovalerylglycine", 6.993, "ESI-", 293.5, 137.2, 209.2, "HMDB0000678"],
 ["13C2_15N1_Isovalerylglycine", 6.993, "ESI-", 296.1, 212.2, 137.2, "-"],
 ["3-Hydroxyglutaric acid", 6.997, "ESI-", 417.3, 222.1, 178, "HMDB0000428"],
 ["2H5_3-Hydroxyglutaric acid", 6.997, "ESI-", 422.1, 225, 178, "-"],
 ["2-Hydroxyglutaric acid", 7.158, "ESI-", 417.3, 137, 220, "HMDB0000694"],
 ["AC_C8", 7.253, "ESI+", 423.4, 220.1, 423.4, "HMDB0000791"],
 ["2H3_AC_C8", 7.253, "ESI+", 426.4, 220.1, "-", "-"],
 ["Glutaric acid", 7.443, "ESI-", 401.4, 248.1, 152, "HMDB0000661"],
 ["13C2_Glutaric acid", 7.443, "ESI-", 401.2, 248.05, 152, "-"],
 ["3-Hydroxy-3-methylglutaric acid", 7.48, "ESI-", 431.4, 236.1, 178, "HMDB0029169"],
 ["Suberylglycine", 7.483, "ESI-", 500.4, 137, 209.1, "HMDB0000953"],
 ["Methylmalonic acid", 7.553, "ESI-", 387.4, 150, 178, "HMDB0000202"],
 ["13C4-Methylmalonic acid", 7.553, "ESI-", 391.4, 151, 179.1, "-"],
 ["Adipic acid", 7.555, "ESI-", 415.4, 178, 262.2, "HMDB0000448"],
 ["Methylsuccinic acid", 7.582, "ESI-", 401.4, 248.1, 112, "HMDB0001844"],
 ["Hexanoylglycine", 7.678, "ESI-", 307.4, 137, 209, "HMDB0000701"],
 ["3-Methylglutaric acid", 7.707, "ESI-", 415.4, 262.1, 152, "HMDB0000752"],
 ["3-Methylglutaconic acid_1", 7.753, "ESI-", 413.1, 260.05, 178, "HMDB0000522"],
 ["Methylcitric acid", 7.788, "ESI-", 457.2, 439.1, 178.2, "HMDB0000379"],
 ["2H3-Methylcitric acid", 7.788, "ESI-", 460.15, 442.05, 178.2, "-"],
 ["AC_C10", 7.886, "ESI+", 451.5, 220.2, 451.3, "HMDB0000651"],
 ["2H3_AC_C10", 7.886, "ESI+", 454.3, 220.2, "-", "-"],
 ["Ethylmalonic acid", 7.938, "ESI-", 401.4, 178, 150, "HMDB0000622"],
 ["Suberic acid", 8.013, "ESI-", 443.35, 152.05, 178.3, "HMDB0000893"],
 ["3-Methylglutaconic acid_2", 8.085, "ESI-", 413.1, 260.05, 178, "HMDB0000522"],
 ["AC_C12", 8.522, "ESI+", 479.5, 220.3, 479.3, "HMDB0002250"],
 ["2H3_AC_C12", 8.522, "ESI+", 482.6, 220.3, "-", "-"],
 ["Sebacic acid", 8.59, "ESI-", 471.5, 137, 318.2, "HMDB0000792"],
 ["AC_C14_1", 8.8, "ESI+", 505.5, 220, 505.3, "HMDB0240588"],
 ["2H3_AC_C14_1", 8.8, "ESI+", 508.3, 220, "-", "-"],
 ["Pyruvic acid_1", 8.943, "ESI-", 357.05, 137.15, 150.25, "HMDB0000243"],
 ["13C3_Pyruvic acid_1", 8.943, "ESI-", 360.1, 137.15, 150.25, "-"],
 ["AC_C16OH", 9.123, "ESI+", 551.4, 220.1, 145.15, "HMDB0013336"],
 ["AC_C14", 9.148, "ESI+", 507.5, 220.1, 507.4, "HMDB0005066"],
 ["2H3_AC_C14", 9.148, "ESI+", 510.5, 220.1, "-", "-"],
 ["AC_C18:1OH", 9.296, "ESI+", 577.4, 220.1, 145.15, "HMDB0240761"],
 ["AC_C16:1", 9.332, "ESI+", 533.4, 220.1, 145.15, "HMDB0253127"],
 ["AC_C16", 9.764, "ESI+", 535.6, 220.2, 535.3, "HMDB0000222"],
 ["2H3_AC_C16", 9.764, "ESI+", 538.4, 220.2, "-", "-"],
 ["Pyruvic acid_2", 9.774, "ESI-", 357.05, 137.15, 150.25, "HMDB0000243"],
 ["13C3_Pyruvic acid_2", 9.774, "ESI-", 360.1, 137.15, 150.25, "-"],
 ["AC_C18:1", 9.878, "ESI+", 561.4, 220.1, 145.15, "HMDB0005065"],
 ["AC_C18", 10.327, "ESI+", 563.6, 220.3, 563.3, "HMDB0000848"],
 ["2H3_AC_C18", 10.327, "ESI+", 566.5, 220.3, "-", "-"]
]

ISO = re.compile(r"^((?:13C\d*|2H\d+|15N\d*)(?:_(?:13C\d*|2H\d+|15N\d*))*)[_-](.+)$")

def nice(raw):
    """Readable analyte name: AC_C14_1 -> Acylcarnitine C14:1; strips the _1/_2 peak suffix of pyruvic and 3-methylglutaconic acid."""
    n = re.sub(r"\s+", " ", raw).strip()
    n = re.sub(r"^(Pyruvic acid|3-Methylglutaconic acid)_[12]$", r"\1", n)
    n = n.replace("3_Methylcrotonylglycine", "3-Methylcrotonylglycine")
    if n.startswith("AC_"):
        n = "Acylcarnitine " + re.sub(r"_(\d)", r":\1", n[3:])
    return n

def split_is(raw):
    m = ISO.match(raw.strip())
    if not m:
        return None, nice(raw)
    label = m.group(1).replace("_", ",").replace("15N1", "15N")
    return label, nice(m.group(2))

transitions, analytes = [], []
for rid, rt, pol, q1, q_quant, q_ref, _hmdb in S4:
    label, base = split_is(rid)
    is_std = label is not None
    name = f"{base}-{label}" if is_std else base
    assigned = None
    if not is_std:
        if base not in analytes:
            analytes.append(base)
    for i, q3 in enumerate([q_quant, q_ref]):
        if q3 in (None, "-", "–"):
            continue
        transitions.append(tr(name, float(q1), float(q3), None, float(rt), 1 if i == 0 else 0, 1 if is_std else 0, None, pol,
                              derivative="3-NPH", is_derivatized=1))
# assign an internal standard only where the label names the analyte itself (e.g. 13C6_Arginine -> Arginine)
is_by_base = {}
for t in transitions:
    if t["is_internal_standard"]:
        base = t["compound_name"].rsplit("-", 1)[0]
        is_by_base.setdefault(base, t["compound_name"])
for t in transitions:
    if not t["is_internal_standard"]:
        t["assigned_is"] = is_by_base.get(t["compound_name"])

# Table 1 (µmol/L): name -> (range, r², LOD, LOQ); Table 2: name -> [(within acc, within CV, between acc, between CV)] for LQC, MQC, HQC
T1 = {
 "3-Hydroxypropionic acid": ("0.20–100", 0.9997, 0.391, 1.563), "Methylcitric acid": ("0.20–50", 0.9973, 0.024, 0.098),
 "Methylmalonic acid": ("0.20–100", 0.9996, 0.195, 0.391), "Lactic acid": ("39.06–20,000", 0.9989, 19.531, 78.125),
 "Pyruvic acid": ("3.91–2000", 0.9997, 0.977, 7.813), "3-Hydroxyisovaleric acid": ("0.39–50", 0.9959, 1.563, 6.250),
 "Isovalerylglycine": ("0.20–50", 0.9999, 0.012, 0.049), "3-Methylcrotonylglycine": ("0.20–25", 0.9990, 0.006, 0.012),
 "3-Methylglutaric acid": ("0.20–25", 0.9979, 0.049, 0.195), "3-Methylglutaconic acid": ("0.20–25", 0.9978, 0.049, 0.098),
 "3-Hydroxy-3-methylglutaric acid": ("0.20–25", 0.9994, 0.049, 0.195), "3-Hydroxyglutaric acid": ("0.20–100", 0.9992, 0.024, 0.098),
 "2-Hydroxyglutaric acid": ("0.20–50", 0.9963, 0.024, 0.098), "Glutaric acid": ("0.20–25", 0.9930, 0.195, 1.563),
 "2-Methyl-3-hydroxybutyric acid": ("0.20–50", 0.9989, 0.012, 1.563), "Tiglylglycine": ("0.20–25", 0.9995, 0.006, 0.006),
 "Orotic acid": ("0.20–25", 0.9967, 0.078, 0.078), "3-Hydroxybutyric acid": ("0.98–125", 0.9932, 0.122, 0.488),
 "Adipic acid": ("0.20–25", 0.9989, 0.391, 1.563), "Suberic acid": ("0.20–25", 0.9981, 0.195, 0.781),
 "Sebacic acid": ("0.20–25", 0.9971, 0.098, 0.781), "Hexanoylglycine": ("0.20–25", 0.9983, 0.006, 0.006),
 "Suberylglycine": ("0.20–25", 0.9956, 0.006, 0.049), "Methylsuccinic acid": ("0.20–25", 0.9956, 0.781, 6.250),
 "Ethylmalonic acid": ("0.20–25", 0.9989, 0.012, 0.049), "Arginine": ("3.91–500", 0.9999, 1.953, 1.953),
 "Glutamine": ("3.91–1000", 0.9912, 0.488, 0.977), "Citrulline": ("1.95–500", 0.9999, 0.031, 0.122),
 "Valine": ("1.95–500", 0.9978, 1.953, 15.625), "Tyrosine": ("1.95–500", 0.9987, 0.488, 1.953),
 "Methionine": ("1.95–500", 0.9993, 0.244, 0.244), "Leucine": ("1.95–500", 0.9991, 7.813, 31.250),
 "Phenylalanine": ("1.95–500", 0.9996, 0.122, 0.977), "Acylcarnitine C0": ("0.20–100", 0.9997, 0.0244, 0.0488),
 "Acylcarnitine C2": ("0.10–50", 0.9994, 0.0031, 0.0061), "Acylcarnitine C3": ("0.02–12", 0.9994, 0.0015, 0.0015),
 "Acylcarnitine C4": ("0.01–5", 0.9998, 0.0024, 0.0098), "Acylcarnitine C4DC": ("0.01–5", 0.9997, 0.0003, 0.0006),
 "Acylcarnitine C5": ("0.01–3", 1.0000, 0.0002, 0.0007), "Acylcarnitine C5:1": ("0.01–5", 0.9992, 0.0003, 0.0003),
 "Acylcarnitine C5OH": ("0.01–5", 0.9993, 0.0006, 0.0006), "Acylcarnitine C5DC": ("0.00–2.5", 0.9993, 0.0003, 0.0006),
 "Acylcarnitine C6": ("0.00–1.25", 0.9992, 0.0003, 0.0024), "Acylcarnitine C8": ("0.00–2.5", 0.9996, 0.0002, 0.0003),
 "Acylcarnitine C10": ("0.00–2.5", 0.9999, 0.0003, 0.0012), "Acylcarnitine C12": ("0.00–2.5", 0.9998, 0.0003, 0.0012),
 "Acylcarnitine C14": ("0.01–3", 0.9998, 0.0007, 0.0029), "Acylcarnitine C14:1": ("0.01–3", 0.9994, 0.0007, 0.0029),
 "Acylcarnitine C16": ("0.02–12", 0.9999, 0.0059, 0.0234), "Acylcarnitine C18": ("0.01–5", 0.9996, 0.0003, 0.0195),
}
A = None  # accuracy not reported (peak-area analytes without internal standard)
T2 = {
 "3-Hydroxypropionic acid": [(109.4, 1.9, 108.5, 4.0), (117.6, 1.5, 119.8, 3.0), (110.4, 0.6, 112.7, 3.0)],
 "Methylcitric acid": [(166.3, 4.3, 175.6, 3.2), (175.0, 2.3, 176.4, 2.6), (137.4, 0.7, 142.9, 3.2)],
 "Methylmalonic acid": [(99.0, 2.0, 98.4, 4.3), (99.0, 1.9, 100.8, 5.2), (86.4, 2.1, 88.6, 1.2)],
 "Lactic acid": [(97.4, 1.8, 99.7, 4.3), (89.4, 1.4, 91.9, 5.9), (76.0, 1.0, 77.3, 3.2)],
 "Pyruvic acid": [(108.9, 1.0, 113.3, 3.3), (128.3, 0.8, 133.2, 3.7), (135.4, 0.2, 139.5, 3.4)],
 "3-Hydroxyisovaleric acid": [(80.6, 2.3, 81.6, 9.3), (84.3, 3.9, 85.9, 5.3), (68.7, 2.5, 69.2, 3.9)],
 "Isovalerylglycine": [(71.9, 2.5, 72.1, 2.7), (71.5, 4.7, 72.6, 6.6), (64.5, 1.3, 64.8, 2.6)],
 "3-Methylcrotonylglycine": [(210.1, 4.1, 219.2, 3.1), (202.7, 2.4, 214.6, 5.4), (184.7, 3.7, 184.7, 1.8)],
 "3-Methylglutaric acid": [(A, 3.1, A, 10.1), (A, 0.6, A, 4.3), (A, 0.7, A, 4.8)],
 "3-Methylglutaconic acid": [(A, 4.7, A, 7.1), (A, 2.1, A, 5.8), (A, 1.3, A, 3.5)],
 "3-Hydroxy-3-methylglutaric acid": [(A, 2.3, A, 7.2), (A, 1.6, A, 4.6), (A, 2.3, A, 2.8)],
 "3-Hydroxyglutaric acid": [(94.4, 1.5, 97.6, 3.0), (93.8, 2.2, 97.4, 5.7), (84.8, 2.2, 87.0, 2.4)],
 "2-Hydroxyglutaric acid": [(A, 2.8, A, 9.1), (A, 0.7, A, 7.1), (A, 3.6, A, 7.2)],
 "Glutaric acid": [(104.2, 2.6, 108.8, 4.6), (99.9, 2.0, 105.0, 4.1), (75.6, 2.5, 78.2, 1.1)],
 "2-Methyl-3-hydroxybutyric acid": [(A, 1.5, A, 8.8), (A, 0.9, A, 4.5), (A, 1.3, A, 4.7)],
 "Tiglylglycine": [(A, 1.5, A, 5.3), (A, 2.3, A, 3.8), (A, 0.7, A, 2.9)],
 "Orotic acid": [(A, 8.4, A, 12.9), (A, 11.2, A, 12.4), (A, 5.4, A, 8.8)],
 "3-Hydroxybutyric acid": [(A, 0.8, A, 4.1), (A, 1.7, A, 3.8), (A, 1.7, A, 4.0)],
 "Adipic acid": [(A, 2.3, A, 9.2), (A, 0.9, A, 6.6), (A, 0.5, A, 5.7)],
 "Suberic acid": [(A, 2.6, A, 9.0), (A, 2.3, A, 6.0), (A, 1.1, A, 4.5)],
 "Sebacic acid": [(A, 2.9, A, 7.4), (A, 4.2, A, 4.2), (A, 1.3, A, 3.9)],
 "Hexanoylglycine": [(A, 0.9, A, 12.1), (A, 1.7, A, 6.9), (A, 2.2, A, 9.7)],
 "Suberylglycine": [(A, 1.5, A, 5.7), (A, 2.0, A, 4.4), (A, 1.6, A, 3.9)],
 "Methylsuccinic acid": [(A, 6.3, A, 9.6), (A, 1.4, A, 5.6), (A, 2.2, A, 3.9)],
 "Ethylmalonic acid": [(A, 4.6, A, 2.8), (A, 2.3, A, 7.4), (A, 2.8, A, 6.0)],
 "Arginine": [(98.7, 1.8, 127.7, 14.0), (101.4, 7.0, 124.2, 14.4), (103.8, 1.2, 118.1, 12.5)],
 "Glutamine": [(A, 4.4, A, 14.6), (A, 7.8, A, 4.5), (A, 3.6, A, 7.0)],
 "Citrulline": [(106.6, 2.8, 108.2, 1.7), (117.5, 1.0, 118.4, 1.7), (115.6, 0.7, 117.4, 1.7)],
 "Valine": [(91.8, 3.6, 101.3, 3.3), (94.6, 1.8, 101.1, 6.1), (89.0, 4.9, 88.6, 3.0)],
 "Tyrosine": [(101.6, 2.0, 104.9, 2.7), (116.1, 1.8, 116.1, 2.6), (115.8, 3.3, 124.8, 5.5)],
 "Methionine": [(104.8, 2.9, 111.2, 5.9), (118.6, 5.2, 118.8, 7.3), (114.9, 4.0, 116.7, 7.3)],
 "Leucine": [(104.5, 1.5, 115.4, 5.2), (107.4, 2.5, 118.8, 8.9), (109.7, 2.0, 115.5, 6.6)],
 "Phenylalanine": [(101.8, 1.7, 111.8, 7.2), (104.8, 1.5, 115.2, 7.0), (104.4, 1.4, 109.8, 7.2)],
 "Acylcarnitine C0": [(97.6, 2.7, 101.2, 7.6), (95.0, 3.3, 96.6, 6.8), (84.9, 2.1, 82.4, 5.5)],
 "Acylcarnitine C2": [(101.4, 1.2, 103.5, 1.4), (101.6, 0.9, 106.2, 3.5), (96.7, 0.5, 101.0, 3.8)],
 "Acylcarnitine C3": [(103.7, 2.6, 102.1, 2.7), (105.9, 1.4, 106.3, 0.9), (92.5, 1.8, 93.5, 3.6)],
 "Acylcarnitine C4": [(99.4, 3.1, 98.9, 4.9), (101.7, 3.3, 102.5, 2.8), (92.2, 1.5, 92.8, 2.6)],
 "Acylcarnitine C4DC": [(87.9, 1.7, 86.1, 5.5), (86.4, 2.3, 84.4, 4.1), (76.9, 1.3, 76.0, 2.8)],
 "Acylcarnitine C5": [(105.0, 2.2, 104.4, 2.5), (103.1, 1.6, 108.3, 2.7), (93.5, 1.5, 97.7, 2.4)],
 "Acylcarnitine C5:1": [(105.2, 2.3, 98.1, 8.9), (106.0, 1.8, 103.8, 5.5), (95.1, 1.7, 92.5, 5.8)],
 "Acylcarnitine C5OH": [(118.5, 2.7, 118.7, 5.8), (129.2, 1.1, 130.9, 4.6), (117.4, 1.7, 118.7, 3.2)],
 "Acylcarnitine C5DC": [(106.4, 1.9, 106.5, 2.7), (112.7, 2.2, 112.9, 3.1), (100.6, 2.7, 103.7, 3.4)],
 "Acylcarnitine C6": [(56.5, 8.9, 54.2, 5.1), (51.2, 11.4, 50.7, 13.7), (34.9, 9.2, 38.9, 10.9)],
 "Acylcarnitine C8": [(96.8, 1.5, 97.4, 1.3), (95.0, 1.5, 98.0, 3.2), (83.4, 1.3, 87.4, 3.4)],
 "Acylcarnitine C10": [(93.8, 2.9, 95.9, 5.4), (97.4, 1.0, 100.0, 5.6), (93.0, 0.7, 96.0, 3.4)],
 "Acylcarnitine C12": [(99.4, 1.0, 101.1, 3.2), (101.5, 0.7, 103.3, 3.1), (88.1, 0.8, 91.6, 2.9)],
 "Acylcarnitine C14": [(100.4, 1.1, 101.7, 2.8), (101.7, 1.0, 103.5, 4.2), (90.5, 1.0, 93.2, 3.7)],
 "Acylcarnitine C14:1": [(101.7, 1.3, 103.3, 3.5), (90.2, 1.4, 93.1, 3.8), (76.4, 0.5, 79.5, 3.8)],
 "Acylcarnitine C16": [(91.8, 1.6, 93.6, 4.2), (90.9, 0.9, 94.3, 3.9), (87.4, 0.9, 90.6, 3.7)],
 "Acylcarnitine C18": [(56.3, 1.3, 55.8, 1.2), (50.6, 1.3, 51.6, 2.1), (71.0, 0.6, 73.9, 3.3)],
 "Acylcarnitine C16:1": [(A, 4.1, A, 10.4)], "Acylcarnitine C16OH": [(A, 4.4, A, 11.3)],
 "Acylcarnitine C18:1": [(A, 1.2, A, 10.1)], "Acylcarnitine C18:1OH": [(A, 3.3, A, 12.2)],
}
val = []
for n in analytes:
    lv = T2[n]
    accs = [a for l in lv for a in (l[0], l[2]) if a is not None]
    t1 = T1.get(n)
    lvl = ["LQC", "MQC", "HQC"][:len(lv)]
    parts = [f"Worst case over {'LQC, MQC and HQC' if len(lv) == 3 else 'LQC only'}."]
    if accs:
        parts.append(f"Accuracy {rng(accs)}% (within- and between-run).")
    else:
        parts.append("No accuracy: quantified as peak area (a.u.) without an internal standard.")
    parts.append(f"Within-run CV {rng([l[1] for l in lv])}%, between-run CV {rng([l[3] for l in lv])}%.")
    if t1:
        parts.append(f"Calibration {t1[0]} µmol/L, r² {t1[1]}; LOD {t1[2]}, LOQ {t1[3]} µmol/L.")
    else:
        parts.append("No commercial standard: no calibration, LOD or LOQ; MQC and HQC not reported.")
    val.append(dict(compound_name=n, lod=t1[2] if t1 else None, loq=t1[3] if t1 else None, r2=t1[1] if t1 else None,
                    cv_percent=max(max(l[1], l[3]) for l in lv), accuracy_percent=worst_acc(accs) if accs else None, notes=" ".join(parts)))

M = dict(
    title="Fully Automated Serum LC-MS/MS Platform and Pediatric Reference Intervals for Organic Acids, Amino Acids, and Acylcarnitines in Children (Ages 0–6 Years): Toward Quantitative Diagnosis of Inborn Errors of Metabolism",
    analyte="25 organic acids, 8 amino acids and 21 acylcarnitines (3-NPH derivatives)", matrix="serum", clinical_application="Inborn Errors of Metabolism",
    ionization_mode="ESI+/ESI- (polarity switching 50ms)", instrument_manufacturer="Shimadzu", instrument_model="LCMS-8050 with CLAM-2030",
    column_brand="Shimadzu GLC", column_name="Shim-pack Scepter HD-C18-80", column_stationary_phase="C18",
    column_length_mm=150, column_diameter_mm=2.1, column_particle_size_um=3.0, column_temperature_c=40,
    mobile_phase_a="Water with 0.1% formic acid", mobile_phase_b="Acetonitrile with 0.1% formic acid", injection_volume_ul=5,
    nebulizing_gas=3.0, drying_gas=15.0, dl_temperature=250, heat_block_temperature=400, collision_gas="230 kPa", is_derivatized=1,
    sample_prep_method="Derivatization",
    sample_prep_details=("Fully automated on the Shimadzu CLAM-2030: protein precipitation of serum followed by 3-nitrophenylhydrazine (3-NPH) derivatization "
                         "with EDC, as described in the authors' earlier paper (reference 15 of the article).\n"
                         "The serum volume, reagent volumes, reaction time and temperature are not given in this article.\n"
                         "Internal standards: stable-isotope standards for amino acids and acylcarnitines from the NeoSMAAT kit (Sekisui Medical) and others listed in supplementary Table S1."),
    validation_units="μmol/L",
    reference=("Ueyanagi Y, Setoyama D, Nakanishi T, Mushimoto Y, Tocan V, Kobayashi H, Matsui M, Matsumoto S, Fujishima A, Hotta T, Sakata A, Kunisaki Y. "
               "Diagnostics. 2026;16(6):911. doi:10.3390/diagnostics16060911"),
    source_type="Journal article",
    source_authors="Ueyanagi Y, Setoyama D, Nakanishi T, Mushimoto Y, Tocan V, Kobayashi H, Matsui M, Matsumoto S, Fujishima A, Hotta T, Sakata A, Kunisaki Y",
    source_url="https://doi.org/10.3390/diagnostics16060911", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY; transitions from the supplementary Excel (Table S4). One serum sample replaces urine organic acids, plasma amino acids and "
           "serum acylcarnitines for the diagnosis of inborn errors of metabolism; all analytes are measured as 3-NPH derivatives in one 24 min run at 0.35 mL/min, "
           "with polarity switching. Dwell times 22–163 ms (at least 20 points per peak). The article also gives pediatric (0–6 years) serum reference intervals "
           "from 296 children (supplementary Tables S5–S6), which are not stored here. "
           "Accuracy was assessed only for the 34 analytes with internal standards; the others are reported as peak areas (a.u.), with precision only. "
           "AC C16:1, C16OH, C18:1 and C18:1OH have no commercial standard (no calibration; LQC precision only).\n\n"
           "To check when reviewing: the gradient is only partly printed (16→70% B from 0 to 18 min, then a 95% B wash and re-equilibration to 16% B, without time points), "
           "so only the first two points are stored; no collision energies are given (Table S4 has precursor, quantifier and reference ions only); "
           "the reference ion of several acylcarnitines equals the precursor (pseudo-transition) and is kept as printed; "
           "pyruvic acid and 3-methylglutaconic acid each appear as two peaks (_1 and _2 in Table S4) and are stored under one name with both retention times; "
           "the 13C2-glutaric acid precursor is printed as 401.2, below the unlabelled 401.4; internal standards are assigned only where the label names the analyte "
           "(e.g. 13C6-arginine for arginine) — the article's Table 1 pairing was not read; "
           "large biases are printed for some analytes (methylcitric acid 137–176%, 3-methylcrotonylglycine 185–219%, AC C6 35–57%, AC C18 51–74%) — stored as printed."),
    gradient_steps=grad([(0, 16), (18, 70)], 0.35), mrm_transitions=transitions,
)

BATCH = [(M, val)]

if __name__ == "__main__":
    dry = "--dry" in sys.argv
    db = SessionLocal()
    client = TestClient(app)
    for payload, v in BATCH:
        if db.query(Method).filter((Method.source_url == payload["source_url"]) | (Method.title == payload["title"])).first():
            print("already imported:", payload["source_url"]); continue
        names = {t["compound_name"] for t in payload["mrm_transitions"] if not t["is_internal_standard"]}
        if {x["compound_name"] for x in v} != names or len(v) != len(names):
            print("NAME MISMATCH, skipped:", names ^ {x["compound_name"] for x in v}); continue
        if dry:
            n_is = len({t["compound_name"] for t in payload["mrm_transitions"] if t["is_internal_standard"]})
            n_ass = sum(1 for t in payload["mrm_transitions"] if t.get("assigned_is"))
            print("ok (dry):", len(payload["mrm_transitions"]), "transitions,", len(names), "analytes,", n_is, "IS,", n_ass, "analyte transitions with IS,",
                  len(v), "validation rows"); continue
        r = client.post("/api/methods/", json=payload)
        if r.status_code != 200:
            print("FAILED", r.status_code, r.text[:300]); sys.exit(1)
        m = r.json()
        for x in v:
            db.add(CompoundValidation(method_id=m["id"], matrix=payload["matrix"], **x))
        db.commit()
        print(f"queued id={m['id']} status={m['status']} transitions={len(m['mrm_transitions'])} gradient={len(m['gradient_steps'])} validation={len(v)} | {m['title'][:46]}")
