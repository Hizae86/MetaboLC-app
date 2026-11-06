import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from backend.routes.methods import router as methods_router
from backend.routes.export import router as export_router
from backend.routes.sop import router as sop_router
from backend.routes.chromatograms import router as chromatograms_router
from backend.database import get_db
from backend.models import Method

# Public site URL used to build absolute links in the sitemap. Override with
# the SITE_URL env var if the production domain differs.
SITE_URL = os.getenv("SITE_URL", "https://metabolc.io").rstrip("/")

app = FastAPI(
    title="MetaboLC API",
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

app.include_router(methods_router, prefix="/api/methods", tags=["methods"])
app.include_router(export_router, prefix="/api", tags=["export"])
app.include_router(sop_router, prefix="/api", tags=["sop"])
app.include_router(chromatograms_router, prefix="/api", tags=["chromatograms"])

@app.get("/")
def root():
    return {
        "message": "MetaboLC API running",
        "version": "0.1.0",
        "docs": "/docs"
    }

@app.get("/sitemap.xml")
def sitemap(db: Session = Depends(get_db)):
    static_paths = ["/", "/methods", "/compounds", "/contributors", "/submit", "/advisor"]
    method_ids = [row[0] for row in db.query(Method.id).all()]

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