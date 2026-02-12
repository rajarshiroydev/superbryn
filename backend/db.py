"""
Supabase database helper for managing users and appointments.
"""

import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger("super-bryn-db")

_supabase_client: Optional[Client] = None


def get_supabase() -> Client:
    """Get or create the Supabase client singleton."""
    global _supabase_client
    if _supabase_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            msg = "Missing SUPABASE_URL or SUPABASE_KEY environment variables."
            logger.critical(msg)
            raise RuntimeError(msg)
        try:
            _supabase_client = create_client(url, key)
        except Exception as e:
            logger.critical(f"Failed to initialize Supabase client: {e}")
            raise
    return _supabase_client


async def get_user_by_phone(phone_number: str) -> Optional[dict]:
    """
    Look up a user by their phone number.

    Returns the user record dict if found, None otherwise.
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("users")
            .select("*")
            .eq("phone_number", phone_number)
            .execute()
        )
        if result.data and len(result.data) > 0:
            logger.info(f"Found user with phone number: {phone_number}")
            return dict(result.data[0])  # type: ignore[arg-type]
        logger.info(f"No user found with phone number: {phone_number}")
        return None
    except Exception as e:
        logger.error(f"Error looking up user by phone {phone_number}: {e}")
        raise


async def create_user(phone_number: str, name: Optional[str] = None) -> dict:
    """
    Create a new user record with the given phone number.

    Returns the created user record dict.
    """
    try:
        supabase = get_supabase()
        user_data = {"phone_number": phone_number}
        if name:
            user_data["name"] = name
        result = supabase.table("users").insert(user_data).execute()
        if result.data and len(result.data) > 0:
            logger.info(f"Created new user with phone number: {phone_number}")
            return dict(result.data[0])  # type: ignore[arg-type]
        raise RuntimeError("Failed to create user — no data returned from Supabase.")
    except Exception as e:
        logger.error(f"Error creating user with phone {phone_number}: {e}")
        raise


async def get_appointment_by_slot(
    phone_number: str, date: str, time: str
) -> Optional[dict]:
    """
    Check if an appointment already exists for the given slot.

    Returns the appointment record if found, None otherwise.
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("appointments")
            .select("*")
            .eq("date", date)
            .eq("time", time)
            .neq("status", "cancelled")
            .execute()
        )
        if result.data and len(result.data) > 0:
            return dict(result.data[0])  # type: ignore[arg-type]
        return None
    except Exception as e:
        logger.error(f"Error checking appointment slot {date} {time}: {e}")
        raise


async def create_appointment(
    phone_number: str, date: str, time: str, reason: Optional[str] = None
) -> dict:
    """
    Create a new appointment record.

    Returns the created appointment record dict.
    """
    try:
        supabase = get_supabase()
        appointment_data = {
            "phone_number": phone_number,
            "date": date,
            "time": time,
            "status": "booked",
        }
        if reason:
            appointment_data["reason"] = reason
        result = supabase.table("appointments").insert(appointment_data).execute()
        if result.data and len(result.data) > 0:
            logger.info(f"Created appointment for {phone_number} on {date} at {time}")
            return dict(result.data[0])  # type: ignore[arg-type]
        raise RuntimeError(
            "Failed to create appointment — no data returned from Supabase."
        )
    except Exception as e:
        logger.error(f"Error creating appointment for {phone_number}: {e}")
        raise


async def get_appointments_by_phone(
    phone_number: str, status: Optional[str] = None
) -> list[dict]:
    """
    Fetch all appointments for a given phone number.

    Args:
        phone_number: The user's phone number.
        status: Optional filter — 'booked', 'cancelled', or None for all.

    Returns a list of appointment dicts, ordered by date and time.
    """
    try:
        supabase = get_supabase()
        query = (
            supabase.table("appointments")
            .select("*")
            .eq("phone_number", phone_number)
            .order("date")
            .order("time")
        )
        if status:
            query = query.eq("status", status)
        result = query.execute()
        if result.data:
            return [dict(row) for row in result.data]  # type: ignore[arg-type]
        return []
    except Exception as e:
        logger.error(f"Error fetching appointments for {phone_number}: {e}")
        raise


async def get_available_slots(date: Optional[str] = None) -> list[dict]:
    """
    Fetch available (not yet booked) slots from the slots table.

    Args:
        date: Optional date filter in YYYY-MM-DD format.

    Returns a list of slot dicts with 'date' and 'time' keys.
    """
    try:
        supabase = get_supabase()
        query = (
            supabase.table("slots")
            .select("*")
            .eq("is_booked", False)
            .order("date")
            .order("time")
        )
        if date:
            query = query.eq("date", date)
        result = query.execute()
        if result.data:
            return [dict(row) for row in result.data]  # type: ignore[arg-type]
        return []
    except Exception as e:
        logger.error(f"Error fetching available slots: {e}")
        raise


async def mark_slot_booked(date: str, time: str) -> None:
    """
    Mark a slot as booked in the slots table.
    """
    try:
        supabase = get_supabase()
        supabase.table("slots").update({"is_booked": True}).eq("date", date).eq(
            "time", time
        ).execute()
        logger.info(f"Marked slot {date} {time} as booked")
    except Exception as e:
        logger.error(f"Error marking slot {date} {time} as booked: {e}")
        raise


async def mark_slot_available(date: str, time: str) -> None:
    """
    Mark a slot as available (not booked) in the slots table.
    """
    try:
        supabase = get_supabase()
        supabase.table("slots").update({"is_booked": False}).eq("date", date).eq(
            "time", time
        ).execute()
        logger.info(f"Marked slot {date} {time} as available")
    except Exception as e:
        logger.error(f"Error marking slot {date} {time} as available: {e}")
        raise


async def cancel_appointment_db(
    phone_number: str, date: str, time: str
) -> Optional[dict]:
    """
    Cancel an appointment by setting its status to 'cancelled'.

    Returns the updated appointment record, or None if not found.
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("appointments")
            .update({"status": "cancelled"})
            .eq("phone_number", phone_number)
            .eq("date", date)
            .eq("time", time)
            .eq("status", "booked")
            .execute()
        )
        if result.data and len(result.data) > 0:
            logger.info(f"Cancelled appointment for {phone_number} on {date} at {time}")
            return dict(result.data[0])  # type: ignore[arg-type]
        return None
    except Exception as e:
        logger.error(f"Error cancelling appointment for {phone_number}: {e}")
        raise


async def update_appointment_db(
    phone_number: str,
    old_date: str,
    old_time: str,
    new_date: str,
    new_time: str,
) -> Optional[dict]:
    """
    Modify an appointment by updating its date and time.

    Returns the updated appointment record, or None if not found.
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("appointments")
            .update({"date": new_date, "time": new_time})
            .eq("phone_number", phone_number)
            .eq("date", old_date)
            .eq("time", old_time)
            .eq("status", "booked")
            .execute()
        )
        if result.data and len(result.data) > 0:
            logger.info(
                f"Modified appointment for {phone_number} from {old_date} {old_time} "
                f"to {new_date} {new_time}"
            )
            return dict(result.data[0])  # type: ignore[arg-type]
        return None
    except Exception as e:
        logger.error(f"Error modifying appointment for {phone_number}: {e}")
        raise


async def save_call_summary(
    phone_number: Optional[str],
    summary: str,
) -> Optional[dict]:
    """
    Save a call summary to the database.

    Args:
        phone_number: The user's phone number (or None if not identified).
        summary: Natural language summary of the conversation.


    Returns the created record dict, or None if save failed.
    """
    try:
        supabase = get_supabase()
        data = {
            "phone_number": phone_number or "unknown",
            "summary": summary,
        }
        result = supabase.table("call_summaries").insert(data).execute()
        if result.data and len(result.data) > 0:
            logger.info(f"Saved call summary for {phone_number}")
            return dict(result.data[0])  # type: ignore[arg-type]
        logger.warning("No data returned when saving call summary")
        return None
    except Exception as e:
        logger.error(f"Error saving call summary: {e}")
        return None
