"""
Custom function tools for the voice agent.
These tools handle appointment booking, user identification, etc.
"""

import json
import re
import asyncio
import logging
from datetime import datetime
from typing import Optional
from livekit.agents import function_tool, RunContext, get_job_context

from db import (
    get_user_by_phone,
    create_user,
    create_appointment,
    get_appointment_by_slot,
    get_appointments_by_phone,
    get_available_slots,
    mark_slot_booked,
    mark_slot_available,
    cancel_appointment_db,
    update_appointment_db,
)

logger = logging.getLogger("super-bryn-tools")


def _friendly_date(date_str: str) -> str:
    """Convert YYYY-MM-DD to a spoken-friendly format like 'Monday, February 9th'."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day = dt.day
        if 11 <= day <= 13:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return dt.strftime(f"%A, %B {day}{suffix}")
    except ValueError:
        return date_str


def _friendly_time(time_str: str) -> str:
    """Convert HH:MM to a spoken-friendly format like '2 PM' or '9:30 AM'."""
    try:
        dt = datetime.strptime(time_str, "%H:%M")
        if dt.minute == 0:
            return dt.strftime("%I %p").lstrip("0")
        return dt.strftime("%I:%M %p").lstrip("0")
    except ValueError:
        return time_str


@function_tool()
async def identify_user(
    context: RunContext,
    phone_number: str,
) -> str:
    """Identify a user by their phone number. Call this tool when the user provides their phone number.

    Args:
        phone_number: The user's phone number, digits only (e.g. 4155551234).
    """
    # Normalize: keep only digits
    normalized = re.sub(r"\D", "", phone_number)
    if not normalized:
        return "Invalid phone number provided. Please ask the user for a valid phone number."

    # Basic validation
    if len(normalized) != 10:
        return (
            f"The phone number '{phone_number}' does not appear to have 10 digits. "
            "Please ask the user for a valid phone number."
        )

    logger.info(f"Identifying user with phone number: {normalized}")

    # Look up user in database
    user = await get_user_by_phone(normalized)

    if user:
        # Store identified user in session userdata for use by other tools
        context.session.userdata["current_user"] = user
        context.session.userdata["phone_number"] = normalized
        name = user.get("name", "")
        if name:
            return (
                f"User identified successfully. Name: {name}, Phone: {normalized}. "
                "Greet them by name and ask how you can help."
            )
        else:
            return (
                f"User identified successfully with phone number {normalized}. "
                "Ask them how you can help."
            )
    else:
        # Create a new user record
        new_user = await create_user(normalized)
        context.session.userdata["current_user"] = new_user
        context.session.userdata["phone_number"] = normalized
        return (
            f"No existing user found for {normalized}. A new account has been created. "
            "Ask the user how you can help them."
        )


@function_tool()
async def fetch_slots(
    context: RunContext,
    date: Optional[str] = None,
) -> str:
    """Fetch available appointment slots. Call this when the user wants to know what
    times are available for booking.

    Args:
        date: Optional date in YYYY-MM-DD format to filter slots for a specific day.
              If not provided, returns slots for all available dates.
    """
    slots = await get_available_slots(date=date)

    if not slots:
        if date:
            return (
                f"No available slots on {date}. "
                "Ask the user if they would like to pick a different date."
            )
        return "There are currently no available appointment slots."

    # Group by date for a clean response
    grouped: dict[str, list[str]] = {}
    for slot in slots:
        d = slot["date"]
        t = slot["time"]
        grouped.setdefault(d, []).append(t)

    if date:
        return json.dumps({"date": date, "available_times": grouped.get(date, [])})
    return json.dumps(grouped)


@function_tool()
async def book_appointment(
    context: RunContext,
    date: str,
    time: str,
):
    """Book an appointment for the identified user at the specified date and time.
    The user must be identified first via identify_user before calling this tool.
    Call this immediately when the user picks a slot. Do not ask for confirmation before calling.

    Args:
        date: The appointment date in YYYY-MM-DD format (e.g. 2026-02-10).
        time: The appointment time in HH:MM 24-hour format (e.g. 14:00).
    """
    # Ensure user is identified
    phone_number = context.session.userdata.get("phone_number")
    if not phone_number:
        return (
            "The user has not been identified yet. "
            "Please ask for their phone number and use identify_user first."
        )

    # Validate the slot exists in available slots (from DB)
    available = await get_available_slots(date=date)
    available_times = [s["time"] for s in available]
    if time not in available_times:
        return (
            f"The slot {date} at {time} is not available. "
            "Use fetch_slots to show the user valid options."
        )

    # Check for double-booking (any user at the same slot)
    existing = await get_appointment_by_slot(phone_number, date, time)
    if existing:
        return (
            f"The slot on {date} at {time} is already booked. "
            "Please ask the user to choose a different time."
        )

    # Create the appointment
    appointment = await create_appointment(phone_number, date, time)

    # Mark the slot as booked in the slots table
    await mark_slot_booked(date, time)

    # Force the agent to speak the confirmation aloud
    await context.session.say(
        f"Your appointment on {_friendly_date(date)} at {_friendly_time(time)} has been booked successfully. Is there anything I can help you with?",
        allow_interruptions=False,
    )

    # Build confirmation message
    return None


@function_tool()
async def retrieve_appointments(
    context: RunContext,
    status: Optional[str] = None,
) -> str:
    """Retrieve appointments for the identified user. Call this when the user wants
    to check their upcoming, past, or all appointments.
    The user must be identified first via identify_user.

    Args:
        status: Optional filter. Use 'booked' for active/upcoming appointments,
                'cancelled' for cancelled ones, or omit for all appointments.
    """
    phone_number = context.session.userdata.get("phone_number")
    if not phone_number:
        return (
            "The user has not been identified yet. "
            "Please ask for their phone number and use identify_user first."
        )

    appointments = await get_appointments_by_phone(phone_number, status=status)

    if not appointments:
        filter_text = f" with status '{status}'" if status else ""
        return (
            f"No appointments found{filter_text} for this user. "
            "Let them know and ask if they'd like to book one."
        )

    # Format appointments for the LLM to read out
    results = []
    for appt in appointments:
        entry = (
            f"Date: {appt.get('date')}, Time: {appt.get('time')}, "
            f"Status: {appt.get('status', 'unknown')}"
        )
        reason = appt.get("reason")
        if reason:
            entry += f", Reason: {reason}"
        results.append(entry)

    summary = "; ".join(results)
    return (
        f"Found {len(appointments)} appointment(s): {summary}. "
        "Present these details to the user in a clear, conversational way."
    )


@function_tool()
async def cancel_appointment(
    context: RunContext,
    date: str,
    time: str,
) -> str:
    """Cancel a booked appointment for the identified user.
    The user must be identified first via identify_user.
    Call this immediately once the user indicates which appointment to cancel. Do not ask for confirmation before calling.

    Args:
        date: The appointment date in YYYY-MM-DD format.
        time: The appointment time in HH:MM 24-hour format.
    """
    phone_number = context.session.userdata.get("phone_number")
    if not phone_number:
        return (
            "The user has not been identified yet. "
            "Please ask for their phone number and use identify_user first."
        )

    cancelled = await cancel_appointment_db(phone_number, date, time)
    if not cancelled:
        return (
            f"No active appointment found on {date} at {time} for this user. "
            "Use retrieve_appointments to check their existing appointments."
        )

    # Free up the slot so others can book it
    await mark_slot_available(date, time)

    # Force the agent to speak the confirmation aloud
    await context.session.say(
        f"Your appointment on {_friendly_date(date)} at {_friendly_time(time)} has been cancelled.",
        allow_interruptions=False,
    )

    return (
        f"The appointment on {date} at {time} has been cancelled successfully. "
        "The confirmation has already been spoken to the user. "
        "Ask if there's anything else you can help with."
    )


@function_tool()
async def modify_appointment(
    context: RunContext,
    old_date: str,
    old_time: str,
    new_date: str,
    new_time: str,
) -> str:
    """Modify an existing appointment by changing its date and/or time.
    The user must be identified first via identify_user.
    Call this immediately once the user provides the old and new slot. Do not ask for confirmation before calling.

    Args:
        old_date: The current appointment date in YYYY-MM-DD format.
        old_time: The current appointment time in HH:MM 24-hour format.
        new_date: The new desired date in YYYY-MM-DD format.
        new_time: The new desired time in HH:MM 24-hour format.
    """
    phone_number = context.session.userdata.get("phone_number")
    if not phone_number:
        return (
            "The user has not been identified yet. "
            "Please ask for their phone number and use identify_user first."
        )

    # Validate the new slot is available
    available = await get_available_slots(date=new_date)
    available_times = [s["time"] for s in available]
    if new_time not in available_times:
        return (
            f"The new slot {new_date} at {new_time} is not available. "
            "Use fetch_slots to show the user valid options."
        )

    # Update the appointment in the database
    updated = await update_appointment_db(
        phone_number, old_date, old_time, new_date, new_time
    )
    if not updated:
        return (
            f"No active appointment found on {old_date} at {old_time} for this user. "
            "Use retrieve_appointments to check their existing appointments."
        )

    # Free the old slot and book the new one
    await mark_slot_available(old_date, old_time)
    await mark_slot_booked(new_date, new_time)

    # Force the agent to speak the confirmation aloud
    await context.session.say(
        f"Your appointment has been moved from {_friendly_date(old_date)} at {_friendly_time(old_time)} to {_friendly_date(new_date)} at {_friendly_time(new_time)}.",
        allow_interruptions=False,
    )

    return (
        f"Appointment has been moved from {old_date} at {old_time} to {new_date} at {new_time}. "
        "The confirmation has already been spoken to the user. "
        "Ask if there's anything else you can help with."
    )


@function_tool()
async def end_conversation(
    context: RunContext,
    confirm: bool = True,
):
    """End the conversation and disconnect the call.
    Call this when the user says goodbye, thanks and leaves, or explicitly asks to end the call.
    Do not call this unless the user clearly wants to stop the conversation.

    Args:
        confirm: Always pass True when calling this tool.
    """
    await context.session.say(
        "Thank you for calling. Have a great day! Goodbye.",
        allow_interruptions=False,
    )

    # Give TTS time to finish speaking before disconnecting
    await asyncio.sleep(4)

    # Disconnect all participants from the room
    try:
        job_ctx = get_job_context()
        await job_ctx.room.disconnect()
    except Exception:
        logger.warning("Could not disconnect room, it may have already closed.")

    return None
