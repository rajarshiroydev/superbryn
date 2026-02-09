from dotenv import load_dotenv
import os
from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import noise_cancellation, silero, groq, tavus
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from tools import (
    identify_user,
    fetch_slots,
    book_appointment,
    retrieve_appointments,
    cancel_appointment,
    modify_appointment,
    end_conversation,
)

load_dotenv()


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant that helps users manage their appointments.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.

            IMPORTANT RULES:
            - At the start of every conversation, ask the user for their phone number to identify them. Use the identify_user tool once they provide it. No need to ask for their name.
            - Once the user is identified, greet them by name if available and ask how you can help.
            - You can help users book, retrieve, modify, or cancel appointments.
            - When the user wants to book an appointment, use fetch_slots to show them available times.
            - Present the available slots in a clear, conversational way (e.g. 'I have openings at 9, 10, and 11 on Monday').
            - When the user picks a slot, immediately call book_appointment. Do NOT ask for confirmation before booking since the tool will speak a confirmation.
            - Do NOT repeat or confirm booking/cancellation/modification details yourself. The tools already handle spoken confirmations.
            - When the user asks about their existing or past appointments, use retrieve_appointments to look them up.
            - Present appointment details conversationally (e.g. 'You have an appointment on Monday the 9th at 9 AM').
            - To cancel, first retrieve their appointments, ask which one, then immediately call cancel_appointment.
            - To modify, first retrieve their appointments, ask which one and the new desired slot, then immediately call modify_appointment.
            - When the user says goodbye or wants to end the call, use end_conversation to disconnect. This will automatically generate a conversation summary, save it, and send it to the user's screen before hanging up.
            - Do NOT try to summarize the call yourself. The end_conversation tool handles the entire summary process automatically.""",
            tools=[
                identify_user,
                fetch_slots,
                book_appointment,
                retrieve_appointments,
                cancel_appointment,
                modify_appointment,
                end_conversation,
            ],
        )


server = AgentServer()


@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt="deepgram/nova-3:multi",
        llm=groq.LLM(model="moonshotai/kimi-k2-instruct-0905"),
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
        userdata={"current_user": None, "phone_number": None, "tool_calls": []},
    )

    avatar = tavus.AvatarSession(
        replica_id=os.getenv("TAVUS_REPLICA_ID") or "",
        persona_id=os.getenv("TAVUS_PERSONA_ID") or "",
    )

    await avatar.start(session, room=ctx.room)

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    await session.generate_reply(
        instructions="Greet the user and offer your assistance. Make sure to speak only English."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
