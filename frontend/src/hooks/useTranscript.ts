"use client";

/* ------------------------------------------------------------------
 * useTranscript — Collects LiveKit transcription segments into a
 *                 sorted message array for the chat panel.
 * ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, TranscriptionSegment, Participant } from "livekit-client";
import type { TranscriptMessage } from "@/lib/types";

export function useTranscript(): TranscriptMessage[] {
  const room = useRoomContext();
  const segmentMap = useRef<Map<string, TranscriptMessage>>(new Map());
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);

  useEffect(() => {
    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant,
    ) => {
      const isUser = participant?.identity === room.localParticipant.identity;
      const speaker = isUser ? "user" : "agent";

      let changed = false;

      for (const seg of segments) {
        // Skip empty segments
        if (!seg.text?.trim()) continue;

        const existing = segmentMap.current.get(seg.id);

        // Only update if text changed or finality changed
        if (
          !existing ||
          existing.text !== seg.text ||
          existing.isFinal !== seg.final
        ) {
          segmentMap.current.set(seg.id, {
            id: seg.id,
            text: seg.text,
            speaker,
            isFinal: seg.final,
            timestamp: seg.firstReceivedTime || Date.now(),
          });
          changed = true;
        }
      }

      if (changed) {
        const sorted = Array.from(segmentMap.current.values()).sort(
          (a, b) => a.timestamp - b.timestamp,
        );
        setMessages(sorted);
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room]);

  return messages;
}
