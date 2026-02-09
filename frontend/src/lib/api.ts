/* ------------------------------------------------------------------
 * Backend API client
 * ------------------------------------------------------------------ */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

/** Request a LiveKit room token from the backend. */
export async function getToken(
  roomName?: string,
  participantName?: string,
): Promise<{ token: string; room_name: string; livekit_url: string }> {
  const res = await fetch(`${BACKEND_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room_name: roomName ?? `superbryn-${crypto.randomUUID().slice(0, 8)}`,
      participant_name: participantName ?? "user",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Token request failed (${res.status}): ${body || res.statusText}`,
    );
  }

  return res.json();
}

/** Fetch stored call summaries for a phone number. */
export async function getCallSummaries(
  phoneNumber: string,
): Promise<{ summaries: unknown[]; total: number }> {
  const res = await fetch(`${BACKEND_URL}/summaries/${phoneNumber}`);
  if (!res.ok) throw new Error(`Failed to fetch summaries: ${res.statusText}`);
  return res.json();
}
