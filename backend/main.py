from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.methods import router as methods_router
from backend.routes.export import router as export_router
from backend.routes.sop import router as sop_router
from backend.routes.chromatograms import router as chromatograms_router

app = FastAPI(
    title="MetaboLC API",
    description="Collaborative knowledge platform for clinical LC-MS/MS laboratories",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
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