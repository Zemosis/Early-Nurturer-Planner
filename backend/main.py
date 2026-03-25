"""
Early Nurturer Planner — FastAPI Application.

Entry point for the backend server. Run with:
    uvicorn main:app --reload --port 8000
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)

from app.api.routers.themes import router as themes_router
from app.api.routers.planner import router as planner_router
from app.api.routers.theme_pool import router as theme_pool_router
from app.api.routers.worker import router as worker_router

app = FastAPI(
    title="Early Nurturer API",
    version="1.0.0",
)

# ── CORS (allow frontend origins) ─────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "https://early-nurturer-api-872290613394.us-central1.run.app",
        "https://early-nurturer-planner.web.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(themes_router)
app.include_router(planner_router)
app.include_router(theme_pool_router)
app.include_router(worker_router)


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
