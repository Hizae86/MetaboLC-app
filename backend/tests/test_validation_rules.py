"""Hand-worked checks of koine-rules@1.0.0 (backend/validation_rules.py).

Run from the repository root:  python3 -m pytest backend/tests -q
"""
import math

import pytest

from backend import validation_rules as vr

NOM = [1, 2, 5, 10, 20, 50, 100, 200]


# ── Calibration (1.1) ──────────────────────────────────────────────────────
def test_lowest_level_gets_20_percent():
    meas = [1.19] + NOM[1:]                       # +19 % at the lowest level: inside ±20 %
    r = vr.evaluate_calibration("bioanalysis_m10", NOM, measured=meas)
    assert r["levels"][0]["limit_pct"] == 20 and r["levels"][0]["pass"]
    assert r["pass"]


def test_75_percent_rule():
    one_fail = [1, 2.32] + NOM[2:]                # level 2 at +16 %: 7/8 pass, 6 needed
    r = vr.evaluate_calibration("clinical_inhouse", NOM, measured=one_fail)
    assert r["passing"] == 7 and r["required_passing"] == 6 and r["pass"]
    three_fail = [1, 2.32, 5.8, 11.6] + NOM[4:]   # 5/8 pass
    r = vr.evaluate_calibration("clinical_inhouse", NOM, measured=three_fail)
    assert r["passing"] == 5 and not r["pass"]


def test_r2_never_decides():
    # The three lowest calibrators 30 % high: r² stays above 0.995 but the run fails.
    meas = [1.3, 2.6, 6.5] + NOM[3:]
    r = vr.evaluate_calibration("bioanalysis_m10", NOM, measured=meas)
    assert r["r2"]["value"] > 0.995
    assert r["r2"]["used_for_verdict"] is False
    assert not r["pass"]


def test_fit_from_responses():
    r = vr.evaluate_calibration("bioanalysis_m10", NOM, response=[0.5 * x + 0.01 for x in NOM])
    assert all(abs(l["bias_pct"]) < 1e-6 for l in r["levels"]) and r["pass"]
    assert r["fit"]["weighting"] in ("1", "1/x", "1/x2")


def test_too_few_levels():
    r = vr.evaluate_calibration("bioanalysis_m10", NOM[:5], measured=NOM[:5])
    assert not r["pass"] and "at least 6" in r["reasons"][0]


# ── Uncertainty (1.13) ──────────────────────────────────────────────────────
def test_uncertainty_budget():
    u = vr.uncertainty_budget(4, bias_pct=3, tea_pct=12)      # u_c = √(16 + 9) = 5, U = 10
    assert math.isclose(u["u_c_pct"], 5) and math.isclose(u["U_pct"], 10) and u["pass"]
    assert vr.uncertainty_budget(4, bias_pct=3, tea_pct=9)["pass"] is False
    assert math.isclose(vr.uncertainty_budget(3, u_bias_pct=4)["U_pct"], 10)
    assert math.isclose(vr.uncertainty_budget(0, bias_pct=3, u_cref_pct=4)["u_bias_pct"], 5)


# ── Plan, profiles and ULOQ confirmation (1.2, 1.14) ───────────────────────
def test_unconfirmed_range_blocks_protocols():
    p = vr.build_plan("bioanalysis_m10", 1, 100)
    assert p["status"] == "draft" and not p["can_generate_protocols"]
    p = vr.build_plan("bioanalysis_m10", 1, 100, range_confirmed=True)
    assert p["status"] == "ready" and p["can_generate_protocols"]


def test_missing_uloq_is_never_filled_in():
    p = vr.build_plan("clinical_inhouse", 1, None, range_confirmed=True)
    assert "ULOQ not set" in p["blockers"] and not p["can_generate_protocols"]
    assert p["range"]["uloq"] is None and not p["range"]["confirmed"]
    s = vr.suggest_range(1.0, None, "ng/mL")
    assert s["uloq"] is None and s["label"] is None and s["missing"] == ["uloq"]
    s = vr.suggest_range(1.0, 100.0, "ng/mL")
    assert s["needs_confirmation"] and s["label"].startswith("Valor sugerido")


def test_m10_qcs_and_calibrators():
    p = vr.build_plan("bioanalysis_m10", 1, 100, range_confirmed=True)
    ap = next(e for e in p["experiments"] if e["key"] == "accuracy_precision")
    assert [q["conc"] for q in ap["qcs"]] == [1, 3, 40.6, 80]
    assert ap["injections"] == 60
    cal = next(e for e in p["experiments"] if e["key"] == "calibration")
    assert cal["levels"][0] == 1 and cal["levels"][-1] == 100 and len(cal["levels"]) == 8
    # 30 cal + 60 A&P + 8 selectivity + 36 matrix + 3 carry-over + 30 stability + 23 reinjection
    assert p["total_injections"] == 190
    assert vr.build_plan("bioanalysis_m10", 1, 100, matrix="Plasma K2-EDTA")["total_injections"] == 196


def test_clinical_designs():
    keys = lambda p: {e["key"] for e in p["experiments"]}
    ap = lambda p: next(e for e in p["experiments"] if e["key"] == "accuracy_precision")
    inh = vr.build_plan("clinical_inhouse", 1, 100)
    assert ap(inh)["injections"] == 75 and "5 days × 5" in ap(inh)["design"]
    assert ap(vr.build_plan("clinical_inhouse", 1, 100, high_risk=True))["injections"] == 240
    assert "ivdr_justification" in keys(inh) and "uncertainty" in keys(inh) and "trueness" in keys(inh)
    ce = vr.build_plan("clinical_ceivd", 1, 100)
    assert ap(ce)["source"] == "CLSI EP15-A3" and "ivdr_justification" not in keys(ce)
    assert "lob_lod" not in keys(inh) and "lob_lod" in keys(vr.build_plan("clinical_inhouse", 1, 100, near_zero=True))
    edta = vr.build_plan("clinical_inhouse", 1, 100, matrix="Plasma K2-EDTA")
    sel = next(e for e in edta["experiments"] if e["key"] == "selectivity")
    assert any("lithium heparin" in c for c in sel["criteria"])
    assert keys(vr.build_plan("own", 1, 100)) == keys(inh) and vr.build_plan("own", 1, 100)["editable"]
    assert "uncertainty" not in keys(vr.build_plan("bioanalysis_m10", 1, 100))


def test_decision_points_become_qcs():
    p = vr.build_plan("clinical_inhouse", 1, 100, decision_points=[50, 5, 20])
    assert [q["conc"] for q in next(e for e in p["experiments"] if e["key"] == "accuracy_precision")["qcs"]] == [5, 20, 50]


def test_dilution_only_when_asked():
    assert "dilution" not in {e["key"] for e in vr.build_plan("bioanalysis_m10", 1, 100)["experiments"]}
    d = next(e for e in vr.build_plan("bioanalysis_m10", 1, 100, dilution_factors=[10, 100])["experiments"]
             if e["key"] == "dilution")
    assert d["injections"] == 10


def test_plan_input_errors():
    with pytest.raises(ValueError):
        vr.build_plan("bioanalysis_m10", 100, 1)
    with pytest.raises(ValueError):
        vr.build_plan("bioanalysis_m10", 1, 100, n_calibrators=5)
    with pytest.raises(ValueError):
        vr.build_plan("clinical_inhouse", 1, 100, n_calibrators=9)
    with pytest.raises(ValueError):
        vr.build_plan("nope", 1, 100)


# ── Change control (Table B) ───────────────────────────────────────────────
def test_routine_and_verification_keep_version():
    assert vr.change_impact(["1"])["next_version"] == "v1.0"
    r = vr.change_impact(["20"], current_version="v1.2")
    assert r["level"] == "verification" and r["next_version"] == "v1.2"


def test_union_keeps_most_runs_and_highest_level():
    r = vr.change_impact(["2", "5"])
    assert r["level"] == "partial" and r["next_version"] == "v1.1"
    ap = next(e for e in r["experiments"] if e["key"] == "accuracy_precision")
    assert ap["runs"] == 1
    r = vr.change_impact(["2", "6"])
    assert next(e for e in r["experiments"] if e["key"] == "accuracy_precision")["runs"] == 3
    r = vr.change_impact(["4", "7"], current_version="v1.4")
    assert r["level"] == "partial_broad" and r["next_version"] == "v1.5" and not r["escalations"]


def test_three_broad_changes_escalate():
    r = vr.change_impact(["4", "7", "9b"], current_version="v1.3")
    assert r["level"] == "full" and r["next_version"] == "v2.0"
    assert r["escalations"][0]["changes"] == ["4", "7", "9b"]
    assert r["full_validation"] and r["experiments"] == []


def test_separation_plus_matrix_escalates():
    r = vr.change_impact(["5", "11"])
    assert r["level"] == "full" and any("separation" in e["rule"] for e in r["escalations"])
    assert vr.change_impact(["17", "15"])["level"] == "full"
    # Sample volume (12) is not classed as matrix / preparation.
    assert vr.change_impact(["2", "12"])["level"] == "partial"


def test_full_rows_and_errors():
    r = vr.change_impact(["3"], profile="bioanalysis_m10")
    assert r["level"] == "full" and {e["key"] for e in r["full_validation"]} >= {"calibration", "accuracy_precision"}
    assert vr.next_version("v1.9", "partial") == "v1.10"
    with pytest.raises(ValueError):
        vr.change_impact(["99"])
    with pytest.raises(ValueError):
        vr.change_impact([])


def test_catalogue_matches_spec():
    ids = [c["id"] for c in vr.CHANGES]
    assert ids == ["1", "2", "3", "4", "5", "6", "7", "8", "9a", "9b"] + [str(i) for i in range(10, 21)]
    levels = {c["id"]: c["level"] for c in vr.CHANGES}
    assert levels["3"] == levels["8"] == "full"
    assert [k for k, v in levels.items() if v == "partial_broad"] == ["4", "7", "9b", "11", "14"]
    assert [k for k, v in levels.items() if v == "routine"] == ["1", "19"]
    assert {p["id"] for p in vr.rules_catalog()["profiles"]} == {"bioanalysis_m10", "clinical_inhouse",
                                                                  "clinical_ceivd", "own"}


def test_bioanalysis_and_clinical_stay_separate():
    fam = {p["id"]: p["family"] for p in vr.rules_catalog()["profiles"]}
    assert fam == {"bioanalysis_m10": "bioanalysis", "clinical_inhouse": "clinical",
                   "clinical_ceivd": "clinical", "own": "clinical"}
    assert all(p["use_for"] for p in vr.rules_catalog()["profiles"])
    m10 = {e["key"] for e in vr.build_plan("bioanalysis_m10", 1, 100)["experiments"]}
    clin = {e["key"] for e in vr.build_plan("clinical_inhouse", 1, 100)["experiments"]}
    assert not m10 & {"trueness", "linearity", "uncertainty", "ivdr_justification", "lob_lod"}
    assert "specificity" in m10 and "specificity" not in clin
    assert vr.build_plan("bioanalysis_m10", 1, 100)["run_acceptance"] != vr.build_plan("clinical_inhouse", 1, 100)["run_acceptance"]


def test_confirmed_citations_20_11_2026():
    clin = vr.evaluate_calibration("clinical_inhouse", NOM, measured=NOM)
    assert clin["source"].startswith("Koiné rule adopted from ICH M10") and "C62" not in clin["source"]
    tr = next(e for e in vr.build_plan("clinical_inhouse", 1, 100)["experiments"] if e["key"] == "trueness")
    assert "§" not in tr["source"]
    ctx = vr.PROFILES["clinical_inhouse"]["context"]
    assert "3rd ed." in ctx and "2nd ed." not in ctx
    for row in ("6", "7", "8", "11", "12", "13", "14", "18"):
        assert "Koiné" in vr.CHANGE_BY_ID[row]["ref"]


def test_hil_is_configurable_and_never_cited_as_ep37():
    sel = lambda p: next(e for e in p["experiments"] if e["key"] == "selectivity")
    d = sel(vr.build_plan("clinical_inhouse", 1, 100))
    assert d["hil"] == vr.HIL_DEFAULTS and "not verified against CLSI EP37" in d["criteria"][0]
    assert "indicative values" in d["criteria"][0]
    c = sel(vr.build_plan("clinical_inhouse", 1, 100, hil={"haemoglobin_mg_dl": 1000, "unknown": 5}))
    assert c["hil"]["haemoglobin_mg_dl"] == 1000 and "unknown" not in c["hil"]
    assert "≥1000 mg/dL Hb" in c["criteria"][0] and "set by the laboratory" in c["criteria"][0]


def test_functional_lloq_over_three_days():
    l = next(e for e in vr.build_plan("clinical_inhouse", 1, 100)["experiments"] if e["key"] == "lloq")
    assert "≥3 days" in l["design"]


def test_ivdr_template():
    t = vr.ivdr_template("Oestradiol", "Serum", "Oestradiol in serum")
    assert t["legal_text"].startswith("the health institution justifies")
    ids = [s["id"] for s in t["sections"]]
    assert ids == ["device", "patient_group", "need", "market", "not_economic", "review"]
    assert "Oestradiol in serum" in t["sections"][0]["text"] and "serum" in t["sections"][0]["text"]
    need = t["sections"][2]
    assert [o["source"].startswith("MDCG") for o in need["options"]][:3] == [True, True, True]
    assert "EUDAMED" in t["sections"][3]["sources"] and len(t["sections"][3]["non_equivalence"]) == 8
    assert "[analyte]" in vr.ivdr_template()["sections"][0]["text"]
