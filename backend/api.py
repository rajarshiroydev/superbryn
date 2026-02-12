"""
FastAPI server exposing REST endpoints for the frontend.
Runs alongside the LiveKit agent worker in production.
"""

import os
import re
import logging
from typing import Optional
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from livekit.api import AccessToken, VideoGrants, RoomConfiguration, RoomAgentDispatch

from db import (
    get_user_by_phone,
    create_user,
    get_available_slots,
    get_appointments_by_phone,
    get_appointment_by_slot,
    create_appointment,
    mark_slot_booked,
    mark_slot_available,
    cancel_appointment_db,
    update_appointment_db,
    save_call_summary,
    get_supabase,
)

load_dotenv()

logger = logging.getLogger("super-bryn-api")
AGENT_NAME = "super-bryn-agent"

app = FastAPI(
    title="SuperBryn Voice Agent API",
    version="1.0.0",
    description="Backend API for the SuperBryn AI Voice Agent",
)

# ------------------------------------------------------------------
# CORS — allow the frontend origin(s)
# ------------------------------------------------------------------
FRONTEND_URL = os.getenv("FRONTEND_URL", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URL.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------
# Pydantic models
# ------------------------------------------------------------------
class TokenRequest(BaseModel):
    """Request body for generating a LiveKit room token."""

    room_name: str = Field(default="super-bryn-room", description="LiveKit room name")
    participant_name: str = Field(
        default="user", description="Display name for the participant"
    )


class TokenResponse(BaseModel):
    token: str
    room_name: str
    livekit_url: str


class UserRequest(BaseModel):
    phone_number: str = Field(..., description="10-digit phone number")
    name: Optional[str] = Field(None, description="Optional user name")


class BookAppointmentRequest(BaseModel):
    phone_number: str
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    time: str = Field(..., description="Time in HH:MM 24-hour format")
    reason: Optional[str] = None


class ModifyAppointmentRequest(BaseModel):
    phone_number: str
    old_date: str
    old_time: str
    new_date: str
    new_time: str


class CancelAppointmentRequest(BaseModel):
    phone_number: str
    date: str
    time: str


class CallSummaryRequest(BaseModel):
    phone_number: Optional[str] = None
    summary: str


# ------------------------------------------------------------------
# Health check
# ------------------------------------------------------------------
@app.get("/")
async def health_check():
    """Health check endpoint for Railway."""
    return {
        "status": "ok",
        "service": "super-bryn-backend",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


# ------------------------------------------------------------------
# LiveKit Token
# ------------------------------------------------------------------
@app.post("/token", response_model=TokenResponse)
async def generate_token(req: TokenRequest):
    """Generate a LiveKit access token so the frontend can join a room."""
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    livekit_url = os.getenv("LIVEKIT_URL")

    if not api_key or not api_secret or not livekit_url:
        raise HTTPException(
            status_code=500, detail="LiveKit credentials not configured on server."
        )

    room_config = RoomConfiguration()
    room_config.agents.append(RoomAgentDispatch(agent_name=AGENT_NAME))

    token = (
        AccessToken(api_key, api_secret)
        .with_identity(req.participant_name)
        .with_name(req.participant_name)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=req.room_name,
            )
        )
        .with_room_config(room_config)
    )

    return TokenResponse(
        token=token.to_jwt(),
        room_name=req.room_name,
        livekit_url=livekit_url,
    )


# ------------------------------------------------------------------
# User endpoints
# ------------------------------------------------------------------
@app.post("/users/identify")
async def identify_user_endpoint(req: UserRequest):
    """Look up a user by phone number. Creates a new record if not found."""
    normalized = re.sub(r"\D", "", req.phone_number)
    if len(normalized) != 10:
        raise HTTPException(
            status_code=400, detail="Phone number must be exactly 10 digits."
        )

    user = await get_user_by_phone(normalized)
    if user:
        return {"user": user, "is_new": False}

    new_user = await create_user(normalized, name=req.name)
    return {"user": new_user, "is_new": True}


@app.get("/users/{phone_number}")
async def get_user(phone_number: str):
    """Fetch a user by phone number."""
    normalized = re.sub(r"\D", "", phone_number)
    user = await get_user_by_phone(normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user": user}


# ------------------------------------------------------------------
# Slot endpoints
# ------------------------------------------------------------------
@app.get("/slots")
async def list_available_slots(
    date: Optional[str] = Query(None, description="YYYY-MM-DD filter"),
):
    """Fetch available appointment slots, optionally filtered by date."""
    slots = await get_available_slots(date=date)
    # Group by date
    grouped: dict[str, list[str]] = {}
    for slot in slots:
        grouped.setdefault(slot["date"], []).append(slot["time"])
    return {"slots": grouped, "total": len(slots)}


# ------------------------------------------------------------------
# Appointment endpoints
# ------------------------------------------------------------------
@app.get("/appointments/{phone_number}")
async def list_appointments(
    phone_number: str,
    status: Optional[str] = Query(
        None, description="Filter: booked, cancelled, or omit for all"
    ),
):
    """Retrieve all appointments for a user."""
    normalized = re.sub(r"\D", "", phone_number)
    appointments = await get_appointments_by_phone(normalized, status=status)
    return {"appointments": appointments, "total": len(appointments)}


@app.post("/appointments/book")
async def book_appointment_endpoint(req: BookAppointmentRequest):
    """Book a new appointment."""
    normalized = re.sub(r"\D", "", req.phone_number)

    # Check the slot is available
    available = await get_available_slots(date=req.date)
    available_times = [s["time"] for s in available]
    if req.time not in available_times:
        raise HTTPException(
            status_code=409, detail=f"Slot {req.date} at {req.time} is not available."
        )

    # Double-booking check
    existing = await get_appointment_by_slot(normalized, req.date, req.time)
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Slot {req.date} at {req.time} is already booked."
        )

    appointment = await create_appointment(
        normalized, req.date, req.time, reason=req.reason
    )
    await mark_slot_booked(req.date, req.time)
    return {"appointment": appointment, "message": "Appointment booked successfully."}


@app.put("/appointments/modify")
async def modify_appointment_endpoint(req: ModifyAppointmentRequest):
    """Modify an existing appointment's date/time."""
    normalized = re.sub(r"\D", "", req.phone_number)

    # Validate new slot
    available = await get_available_slots(date=req.new_date)
    available_times = [s["time"] for s in available]
    if req.new_time not in available_times:
        raise HTTPException(
            status_code=409,
            detail=f"New slot {req.new_date} at {req.new_time} is not available.",
        )

    updated = await update_appointment_db(
        normalized, req.old_date, req.old_time, req.new_date, req.new_time
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"No active appointment on {req.old_date} at {req.old_time}.",
        )

    await mark_slot_available(req.old_date, req.old_time)
    await mark_slot_booked(req.new_date, req.new_time)
    return {"appointment": updated, "message": "Appointment modified successfully."}


@app.delete("/appointments/cancel")
async def cancel_appointment_endpoint(req: CancelAppointmentRequest):
    """Cancel a booked appointment."""
    normalized = re.sub(r"\D", "", req.phone_number)

    cancelled = await cancel_appointment_db(normalized, req.date, req.time)
    if not cancelled:
        raise HTTPException(
            status_code=404,
            detail=f"No active appointment on {req.date} at {req.time}.",
        )

    await mark_slot_available(req.date, req.time)
    return {"appointment": cancelled, "message": "Appointment cancelled successfully."}


# ------------------------------------------------------------------
# Call summary endpoints
# ------------------------------------------------------------------
@app.get("/summaries/{phone_number}")
async def get_call_summaries(phone_number: str):
    """Fetch call summaries for a user."""
    normalized = re.sub(r"\D", "", phone_number)
    try:
        supabase = get_supabase()
        result = (
            supabase.table("call_summaries")
            .select("*")
            .eq("phone_number", normalized)
            .order("created_at", desc=True)
            .execute()
        )
        summaries = result.data or []
        return {"summaries": summaries, "total": len(summaries)}
    except Exception as e:
        logger.error(f"Error fetching summaries for {normalized}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch call summaries.")


@app.post("/summaries")
async def create_call_summary(req: CallSummaryRequest):
    """Save a call summary."""
    result = await save_call_summary(phone_number=req.phone_number, summary=req.summary)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to save call summary.")
    return {"summary": result, "message": "Summary saved."}
