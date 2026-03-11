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

app = FastAPI(
    title="Early Nurturer API",
    version="1.0.0",
)

# ── CORS (allow Next.js frontend) ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(themes_router)
app.include_router(planner_router)


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
