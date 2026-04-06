"""
FastAPI router — AI Chat Assistant.

Lightweight conversational endpoint powered by Gemini 2.5 Flash
with optional structured activity edits via function calling.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.chat_service import (
    get_or_create_thread,
    create_new_thread,
    delete_thread,
    get_thread_for_plan,
    get_thread_history,
    list_threads,
    send_message,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ── Request / Response schemas ───────────────────────────────

class SendMessageRequest(BaseModel):
    thread_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=2000)
    plan_id: Optional[str] = None
    plan_context: Optional[dict] = None


class SendMessageResponse(BaseModel):
    thread_id: str
    message: dict
    activity_edit: Optional[dict] = None
    thread_rotated: bool = False
    error: Optional[dict] = None


class NewThreadRequest(BaseModel):
    plan_id: Optional[str] = None
    plan_context: Optional[dict] = None


# ── Endpoints ────────────────────────────────────────────────


@router.post("/{user_id}/message", response_model=SendMessageResponse)
async def post_message(user_id: str, body: SendMessageRequest):
    """Send a message and get an AI response.

    - If no thread_id is provided, finds or creates a thread scoped to plan_id.
    - plan_context is only needed on the first message of a new thread.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    thread_id = body.thread_id
    if not thread_id:
        thread_id = await get_or_create_thread(
            user_id, plan_id=body.plan_id, plan_context=body.plan_context
        )

    result = await send_message(
        user_id=user_id,
        thread_id=thread_id,
        user_message=body.message,
        plan_context=body.plan_context,
    )
    return result


@router.get("/{user_id}/threads")
async def get_threads(user_id: str):
    """List user's chat threads."""
    threads = await list_threads(user_id)
    return threads


@router.get("/{user_id}/plan/{plan_id}/thread")
async def get_plan_thread(user_id: str, plan_id: str):
    """Get the active thread for a specific plan with recent messages.

    Returns { thread_id, messages } or { thread_id: null, messages: [] }.
    """
    result = await get_thread_for_plan(user_id, plan_id)
    if result:
        return result
    return {"thread_id": None, "messages": []}


@router.get("/{user_id}/thread/{thread_id}")
async def get_thread(
    user_id: str,
    thread_id: str,
    cursor: Optional[str] = None,
    limit: int = 50,
):
    """Load thread history with cursor-based pagination."""
    if limit < 1 or limit > 200:
        limit = 50
    result = await get_thread_history(thread_id, cursor=cursor, limit=limit)
    return result


@router.delete("/{user_id}/thread/{thread_id}")
async def remove_thread(user_id: str, thread_id: str):
    """Delete all messages in a thread."""
    deleted = await delete_thread(user_id, thread_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Thread not found.")
    return {"status": "deleted", "thread_id": thread_id}


@router.post("/{user_id}/thread/new")
async def new_thread(user_id: str, body: NewThreadRequest = NewThreadRequest()):
    """Force-start a new chat thread scoped to a plan."""
    thread_id = await create_new_thread(
        user_id, plan_id=body.plan_id, plan_context=body.plan_context
    )
    return {"thread_id": thread_id}
