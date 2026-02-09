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
from groq import AsyncGroq

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
    save_call_summary,
)

logger = logging.getLogger("super-bryn-tools")


def _track(context: RunContext, action: str):
    """Track a tool action in session userdata for call summary generation."""
    context.session.userdata.setdefault("tool_calls", []).append(
        {
            "action": action,
            "timestamp": datetime.now().isoformat(),
        }
    )


async def _generate_call_summary(
    tool_calls: list[dict],
    phone_number: Optional[str],
    user_name: Optional[str],
) -> dict:
    """Generate a structured call summary using Groq LLM."""
    actions_text = (
        "\n".join(f"- [{tc['timestamp']}] {tc['action']}" for tc in tool_calls)
        or "No specific actions were taken during this call."
    )

    prompt = f"""You are summarizing a voice call between an AI appointment assistant and a user.

User Info:
- Name: {user_name or "Not provided"}
- Phone: {phone_number or "Not provided"}

Actions taken during the call:
{actions_text}

Generate a JSON summary with these exact keys:
{{
    "summary": "A concise 2-3 sentence natural language summary. MUST include the exact date and time for every appointment that was booked, cancelled, or modified. For modifications, include both the old and new date/time.",
    "appointments": [
        {{"action": "booked/cancelled/modified/retrieved", "date": "YYYY-MM-DD", "time": "HH:MM", "new_date": "YYYY-MM-DD or null", "new_time": "HH:MM or null", "details": "brief note"}}
    ]
}}

CRITICAL: The "summary" field MUST explicitly mention the specific date and time for every booking, cancellation, and modification. Never say vague things like 'next day' or 'an appointment' without the exact date (e.g. 2026-02-10) and time (e.g. 14:00).

Return ONLY valid JSON, no markdown fences, no extra text."""

    try:
        client = AsyncGroq()
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=500,
        )
        content = response.choices[0].message.content.strip()

        # Strip markdown code fences if the model wrapped its response
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        return json.loads(content)
    except Exception as e:
        logger.warning(f"LLM summary generation failed, using fallback: {e}")
        # Fallback: build a basic summary from tool calls data
        appointment_actions = [
            tc["action"]
            for tc in tool_calls
            if any(
                kw in tc["action"].lower() for kw in ["booked", "cancelled", "modified"]
            )
        ]
        return {
            "summary": (
                f"Call with {user_name or 'user'} ({phone_number or 'unknown'}). "
                f"{len(tool_calls)} action(s) performed during the call."
            ),
            "appointments": [
                {"action": a, "date": "", "time": "", "details": a}
                for a in appointment_actions
            ],
        }


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
        _track(context, f"Identified existing user: {name or normalized}")
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
        _track(context, f"Created new user account for {normalized}")
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

    total = sum(len(v) for v in grouped.values())
    _track(context, f"Fetched {total} available slot(s) for {date or 'all dates'}")

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

    _track(context, f"Booked appointment on {date} at {time}")

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

    _track(context, f"Retrieved {len(appointments)} appointment(s)")

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

    _track(context, f"Cancelled appointment on {date} at {time}")

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

    _track(
        context,
        f"Modified appointment from {old_date} {old_time} to {new_date} {new_time}",
    )

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
    """End the conversation and disconnect the call. Generates a summary of the
    conversation before disconnecting.
    Call this when the user says goodbye, thanks and leaves, or explicitly asks to end the call.
    Do not call this unless the user clearly wants to stop the conversation.

    Args:
        confirm: Always pass True when calling this tool.
    """
    phone_number = context.session.userdata.get("phone_number")
    user = context.session.userdata.get("current_user")
    user_name = user.get("name") if user and isinstance(user, dict) else None
    tool_calls = context.session.userdata.get("tool_calls", [])

    # --- Generate call summary ---
    summary_data = await _generate_call_summary(tool_calls, phone_number, user_name)
    summary_data["timestamp"] = datetime.now().isoformat()
    summary_data["phone_number"] = phone_number
    summary_data["user_name"] = user_name

    # --- Build full summary with appointment details for DB ---
    summary_text = summary_data.get("summary", "No summary available.")
    appointments = summary_data.get("appointments", [])

    full_parts = [summary_text]
    if appointments:
        appt_lines = []
        for appt in appointments:
            action = appt.get("action", "")
            date = appt.get("date", "")
            time_val = appt.get("time", "")
            new_date = appt.get("new_date")
            new_time = appt.get("new_time")
            details = appt.get("details", "")
            line = f"{action.title()}"
            if date:
                line += f" on {date}"
            if time_val:
                line += f" at {time_val}"
            if new_date and new_time:
                line += f" -> moved to {new_date} at {new_time}"
            if details:
                line += f" ({details})"
            appt_lines.append(line)
        full_parts.append("Appointments: " + "; ".join(appt_lines))

    full_summary = " | ".join(full_parts)

    # --- Save summary to database ---
    try:
        await save_call_summary(
            phone_number=phone_number,
            summary=full_summary,
        )
        logger.info("Call summary saved to database")
    except Exception as e:
        logger.error(f"Failed to save call summary to DB: {e}")

    # --- Publish summary to the room so the frontend can display it ---
    try:
        job_ctx = get_job_context()
        payload = json.dumps(
            {
                "type": "call_summary",
                **summary_data,
            }
        ).encode("utf-8")
        await job_ctx.room.local_participant.publish_data(
            payload=payload,
            topic="call_summary",
            reliable=True,
        )
        logger.info("Published call summary to room")
    except Exception as e:
        logger.error(f"Failed to publish call summary to room: {e}")

    # --- Say goodbye (give frontend a moment to render summary) ---
    await context.session.say(
        "I've prepared a summary of our conversation which you can see on your screen. "
        "Thank you for calling. Have a great day! Goodbye.",
        allow_interruptions=False,
    )

    # Give TTS time to finish and frontend time to display the summary
    await asyncio.sleep(5)

    # --- Disconnect ---
    try:
        job_ctx = get_job_context()
        await job_ctx.room.disconnect()
    except Exception:
        logger.warning("Could not disconnect room, it may have already closed.")

    return None
