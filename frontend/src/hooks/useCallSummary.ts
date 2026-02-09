"use client";

/* ------------------------------------------------------------------
 * useCallSummary — Listens for the "call_summary" data message
 *                  published by the agent at end-of-call.
 * ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import type { CallSummary } from "@/lib/types";

export function useCallSummary(): CallSummary | null {
  const room = useRoomContext();
  const [summary, setSummary] = useState<CallSummary | null>(null);

  useEffect(() => {
    const handleData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== "call_summary") return;

      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text) as CallSummary;
        setSummary(data);
      } catch (err) {
        console.error("[useCallSummary] Failed to parse payload:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  return summary;
}
