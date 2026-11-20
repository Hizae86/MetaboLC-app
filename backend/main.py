import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from backend.routes.methods import router as methods_router
from backend.routes.search import router as search_router
from backend.routes.export import router as export_router
from backend.routes.sop import router as sop_router
from backend.routes.chromatograms import router as chromatograms_router
from backend.routes.validation import router as validation_router
from backend.routes.tools import router as tools_router
from backend.routes.panel import router as panel_router
from backend.routes.validation_engine import router as validation_engine_router
from backend.database import get_db
from backend.models import Method
from backend import schema_upgrades

# Add any columns introduced after this database was created (idempotent).
schema_upgrades.apply()

# Public site URL used to build absolute links in the sitemap. Override with
# the SITE_URL env var if the production domain differs.
SITE_URL = os.getenv("SITE_URL", "https://metabolc.io").rstrip("/")

app = FastAPI(
    title="Koiné API",
    description="Collaborative knowledge platform for clinical LC-MS/MS laboratories",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Must be registered before methods_router: its "/{method_id}" route would
# otherwise capture "/search" and "/suggest" and answer 422.
app.include_router(search_router, prefix="/api/methods", tags=["search"])
app.include_router(methods_router, prefix="/api/methods", tags=["methods"])
app.include_router(export_router, prefix="/api", tags=["export"])
app.include_router(sop_router, prefix="/api", tags=["sop"])
app.include_router(chromatograms_router, prefix="/api", tags=["chromatograms"])
app.include_router(validation_router, prefix="/api", tags=["validation"])
app.include_router(tools_router, prefix="/api", tags=["tools"])
app.include_router(panel_router, prefix="/api", tags=["tools"])
app.include_router(validation_engine_router, prefix="/api", tags=["validation"])

@app.get("/")
def root():
    return {
        "message": "Koiné API running",
        "version": "0.1.0",
        "docs": "/docs"
    }

@app.get("/sitemap.xml")
def sitemap(db: Session = Depends(get_db)):
    static_paths = ["/", "/methods", "/compounds", "/contributors", "/submit", "/advisor", "/modules", "/validation", "/validation/plan", "/panel-builder"]
    method_ids = [row[0] for row in db.query(Method.id).filter(Method.status.in_(("pending", "verified"))).all()]

    urls = [f"{SITE_URL}{p}" for p in static_paths]
    urls += [f"{SITE_URL}/method/{mid}" for mid in method_ids]

    entries = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n"
        "</urlset>"
    )
    return Response(content=xml, media_type="application/xml")