"""Genera un sitio estático (una página HTML por método) a partir de metabolc.db.

Uso:
    python3 build_static.py --db ../metabolc.db --out dist [--site-url https://metabolc.io]

Solo incluye métodos con status 'pending' o 'verified' (mismas reglas que la API).
No usa dependencias externas (solo biblioteca estándar).
"""
import argparse
import html
import json
import os
import re
import shutil
import sqlite3
import unicodedata
from datetime import datetime, timezone

PUBLIC_STATUSES = ("pending", "verified")
STATUS_LABEL = {
    "verified": "Verified against source document",
    "pending": "Published; not yet checked against source",
}


def slugify(text, max_len=90):
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if len(text) > max_len:
        text = text[:max_len].rsplit("-", 1)[0]  # corta en una palabra completa
    return text or "method"


def e(value):
    return html.escape("" if value is None else str(value))


def fmt(value, unit=""):
    if value is None or value == "":
        return "—"
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return f"{value} {unit}".strip()


def date_only(value):
    if not value:
        return None
    return str(value)[:10]


def load_methods(db_path):
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    placeholders = ",".join("?" * len(PUBLIC_STATUSES))
    methods = [dict(r) for r in con.execute(
        f"SELECT * FROM methods WHERE status IN ({placeholders}) ORDER BY id", PUBLIC_STATUSES)]
    transitions = {}
    for r in con.execute("SELECT * FROM mrm_transitions ORDER BY method_id, is_internal_standard, id"):
        transitions.setdefault(r["method_id"], []).append(dict(r))
    con.close()
    for m in methods:
        m["transitions"] = transitions.get(m["id"], [])
    return methods


def assign_slugs(methods):
    """Slug = nombre del método en minúsculas. Si se repite, se añade el id."""
    seen = {}
    for m in methods:
        base = slugify(m["title"])
        if base in seen:
            base = f"{base}-{m['id']}"
        seen[base] = m["id"]
        m["slug"] = base
    return methods


def transitions_table(rows):
    if not rows:
        return "<p>No MRM transitions recorded.</p>"
    body = []
    for t in rows:
        role = "Internal standard" if t.get("is_internal_standard") else "Analyte"
        body.append(
            "<tr>"
            f"<td>{e(t['compound_name'])}</td><td>{e(role)}</td>"
            f"<td>{e(fmt(t['precursor_mz']))}</td><td>{e(fmt(t['product_mz']))}</td>"
            f"<td>{e(fmt(t.get('collision_energy_ev'), 'eV'))}</td>"
            f"<td>{e(fmt(t.get('declustering_potential'), 'V'))}</td>"
            f"<td>{e(fmt(t.get('retention_time_min'), 'min'))}</td>"
            f"<td>{e(t.get('polarity') or '—')}</td>"
            "</tr>"
        )
    return (
        "<table><thead><tr><th>Compound</th><th>Role</th><th>Precursor m/z</th>"
        "<th>Product m/z</th><th>CE</th><th>DP</th><th>RT</th><th>Polarity</th></tr></thead>"
        "<tbody>" + "".join(body) + "</tbody></table>"
    )


def kv_rows(pairs):
    return "".join(f"<tr><th>{e(k)}</th><td>{v}</td></tr>" for k, v in pairs if v not in (None, "", "—"))


def render_method(m, site_url):
    url = f"{site_url}/metodos/{m['slug']}/"
    title = m["title"]
    description = (
        f"LC-MS/MS method for {m['analyte']} in {m['matrix']} ({m['ionization_mode']}), "
        f"{m['instrument_manufacturer']} instrument. Transitions, conditions and source reference."
    )[:160]
    updated = date_only(m.get("updated_at")) or date_only(m.get("created_at"))

    schema = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": title,
        "name": title,
        "description": description,
        "about": m["analyte"],
        "url": url,
        "identifier": url,
        "inLanguage": "en",
        "isBasedOn": m.get("source_url") or None,
        "citation": m.get("reference") or None,
        "dateModified": updated,
        "publisher": {"@type": "Organization", "name": "MetaboLC"},
    }
    if m.get("submitted_by"):
        schema["author"] = {"@type": "Person", "name": m["submitted_by"]}
    schema = {k: v for k, v in schema.items() if v is not None}

    chromatography = kv_rows([
        ("Column", f"{m.get('column_brand') or ''} {m.get('column_name') or ''}".strip() or None),
        ("Stationary phase", m.get("column_stationary_phase")),
        ("Dimensions", f"{fmt(m.get('column_length_mm'))} × {fmt(m.get('column_diameter_mm'))} mm"
         if m.get("column_length_mm") else None),
        ("Particle size", fmt(m.get("column_particle_size_um"), "µm")
         if m.get("column_particle_size_um") else None),
        ("Column temperature", fmt(m.get("column_temperature_c"), "°C")
         if m.get("column_temperature_c") else None),
        ("Mobile phase A", e(m.get("mobile_phase_a"))),
        ("Mobile phase B", e(m.get("mobile_phase_b"))),
        ("Injection volume", fmt(m.get("injection_volume_ul"), "µL")
         if m.get("injection_volume_ul") else None),
    ])
    instrument = kv_rows([
        ("Manufacturer", e(m.get("instrument_manufacturer"))),
        ("Model", e(m.get("instrument_model"))),
        ("Ionization mode", e(m.get("ionization_mode"))),
    ])
    validation = kv_rows([
        ("LLOQ", fmt(m.get("lloq"), m.get("lloq_unit") or "")) if m.get("lloq") else (None, None),
        ("ULOQ", fmt(m.get("uloq"), m.get("validation_units") or "")) if m.get("uloq") else (None, None),
        ("Intra-assay CV", fmt(m.get("cv_intra_percent"), "%") if m.get("cv_intra_percent") else None),
        ("Inter-assay CV", fmt(m.get("cv_inter_percent"), "%") if m.get("cv_inter_percent") else None),
        ("Recovery", fmt(m.get("recovery_percent"), "%") if m.get("recovery_percent") else None),
    ])
    sample_prep = e(m.get("sample_prep_details") or m.get("sample_prep_method") or "")
    source_authors = e(m.get("source_authors") or "")
    source_link = (f'<a href="{e(m["source_url"])}" rel="nofollow noopener">{e(m["source_url"])}</a>'
                   if m.get("source_url") else "")
    status_text = STATUS_LABEL.get(m["status"], m["status"])

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | MetaboLC</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{e(url)}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:type" content="article">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
<style>
body{{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#111}}
table{{border-collapse:collapse;width:100%;margin:.5rem 0 1.5rem;font-size:.92rem}}
th,td{{border-bottom:1px solid #ddd;padding:.35rem .5rem;text-align:left;vertical-align:top}}
.meta th{{width:14rem;color:#444;font-weight:600}}
.status{{display:inline-block;padding:.15rem .5rem;border-radius:4px;background:#eef;font-size:.85rem}}
nav a{{margin-right:1rem}}
</style>
</head>
<body>
<nav><a href="/">MetaboLC</a><a href="/metodos/">All methods</a></nav>
<h1>{e(title)}</h1>
<p><span class="status">{e(status_text)}</span> · Last updated {e(updated or "—")}</p>
<p>{e(description)}</p>

<h2>Summary</h2>
<table class="meta"><tbody>{kv_rows([
    ("Analyte", e(m["analyte"])),
    ("Matrix", e(m["matrix"])),
    ("Clinical application", e(m.get("clinical_application"))),
    ("Validation level", e(m.get("validation_level"))),
    ("Laboratory", e(m.get("laboratory"))),
    ("Country", e(m.get("country"))),
])}</tbody></table>

<h2>MRM transitions</h2>
{transitions_table(m["transitions"])}

<h2>Instrument</h2>
<table class="meta"><tbody>{instrument}</tbody></table>

<h2>Chromatography and injection</h2>
<table class="meta"><tbody>{chromatography or '<tr><td>No data recorded.</td></tr>'}</tbody></table>

<h2>Sample preparation</h2>
<p>{sample_prep or "No details recorded."}</p>

<h2>Validation</h2>
<table class="meta"><tbody>{validation or '<tr><td>No validation data recorded.</td></tr>'}</tbody></table>

<h2>Source</h2>
<table class="meta"><tbody>{kv_rows([
    ("Reference", e(m.get("reference"))),
    ("Document type", e(m.get("source_type"))),
    ("Authors", source_authors),
    ("Link", source_link),
    ("Transcribed and reviewed by", e(m.get("submitted_by"))),
])}</tbody></table>
<p>The method above is a summary of the cited source. Check the original document before use.</p>
</body>
</html>
"""


def render_index(methods):
    items = "".join(
        f'<li><a href="/metodos/{e(m["slug"])}/">{e(m["title"])}</a> '
        f'<small>({e(m["matrix"])}, {e(m["ionization_mode"])})</small></li>'
        for m in methods
    )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>All LC-MS/MS methods | MetaboLC</title>
<meta name="description" content="Index of LC-MS/MS methods in the MetaboLC reference library.">
<link rel="canonical" href="/metodos/">
</head><body>
<h1>LC-MS/MS methods</h1>
<ul>{items}</ul>
</body></html>
"""


def render_redirect(m, site_url):
    target = f"/metodos/{m['slug']}/"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Redirecting…</title>
<link rel="canonical" href="{e(site_url + target)}">
<meta http-equiv="refresh" content="0; url={e(target)}">
</head><body><a href="{e(target)}">Continue to method</a></body></html>
"""


def build(db_path, out_dir, site_url):
    methods = assign_slugs(load_methods(db_path))
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)

    for m in methods:
        page_dir = os.path.join(out_dir, "metodos", m["slug"])
        os.makedirs(page_dir)
        with open(os.path.join(page_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(render_method(m, site_url))
        # Redirección desde la URL antigua /method/<id>
        old_dir = os.path.join(out_dir, "method", str(m["id"]))
        os.makedirs(old_dir)
        with open(os.path.join(old_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(render_redirect(m, site_url))

    os.makedirs(os.path.join(out_dir, "metodos"), exist_ok=True)
    with open(os.path.join(out_dir, "metodos", "index.html"), "w", encoding="utf-8") as f:
        f.write(render_index(methods))

    urls = [f"{site_url}/metodos/"] + [f"{site_url}/metodos/{m['slug']}/" for m in methods]
    lastmods = {f"{site_url}/metodos/{m['slug']}/": date_only(m.get("updated_at")) for m in methods}
    entries = []
    for u in urls:
        lm = lastmods.get(u)
        entries.append(f"  <url><loc>{e(u)}</loc>" + (f"<lastmod>{lm}</lastmod>" if lm else "") + "</url>")
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               + "\n".join(entries) + "\n</urlset>\n")
    with open(os.path.join(out_dir, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap)
    with open(os.path.join(out_dir, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(f"User-agent: *\nAllow: /\n\nSitemap: {site_url}/sitemap.xml\n")

    report = {"built_at": datetime.now(timezone.utc).isoformat(), "methods": len(methods),
              "slugs": {m["slug"]: m["id"] for m in methods}}
    with open(os.path.join(out_dir, "build_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return len(methods)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--out", default="dist")
    ap.add_argument("--site-url", default=os.getenv("SITE_URL", "https://metabolc.io"))
    args = ap.parse_args()
    n = build(args.db, args.out, args.site_url.rstrip("/"))
    print(f"OK: {n} methods written to {args.out}")
