"use client";

/* ------------------------------------------------------------------
 * useToolCalls — Listens for "tool_call" data messages published by
 *                the agent whenever it invokes a function tool.
 * ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import type { ToolCallEvent } from "@/lib/types";

export function useToolCalls(): ToolCallEvent[] {
  const room = useRoomContext();
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const handleData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== "tool_call") return;

      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        if (data.type !== "tool_call") return;

        const event: ToolCallEvent = {
          id: `tc-${++nextId.current}`,
          type: "tool_call",
          tool: data.tool || "",
          action: data.action || "",
          timestamp: data.timestamp || new Date().toISOString(),
        };

        setToolCalls((prev) => [...prev, event]);
      } catch (err) {
        console.error("[useToolCalls] Failed to parse payload:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  return toolCalls;
}
