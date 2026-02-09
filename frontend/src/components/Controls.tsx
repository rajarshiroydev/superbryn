"use client";

/* ------------------------------------------------------------------
 * Controls — Microphone mute toggle, end-call button, and
 *            connection-quality indicator.
 * ------------------------------------------------------------------ */

import { useRoomContext } from "@livekit/components-react";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";

interface Props {
  onDisconnect: () => void;
}

export function Controls({ onDisconnect }: Props) {
  const room = useRoomContext();
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = useCallback(async () => {
    await room.localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted((m) => !m);
  }, [room, isMuted]);

  const handleEnd = useCallback(async () => {
    try {
      await room.disconnect();
    } catch {
      /* room may already be disconnected */
    }
    onDisconnect();
  }, [room, onDisconnect]);

  return (
    <motion.div
      className="flex items-center justify-center gap-3 py-4 px-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      {/* Mute / unmute */}
      <button
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        className={`group relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 ${
          isMuted
            ? "bg-red-500/15 border border-red-500/25 hover:bg-red-500/25"
            : "bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.10]"
        }`}
      >
        {isMuted ? (
          /* Mic off icon */
          <svg
            className="w-[18px] h-[18px] text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m3 3 18 18M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M12 18.75a6 6 0 0 1-6-6v-1.5m12 1.5a6 6 0 0 1-.34 2M12 18.75v3.75m-3.75 0h7.5"
            />
          </svg>
        ) : (
          /* Mic on icon */
          <svg
            className="w-[18px] h-[18px] text-white/60 group-hover:text-white/80 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
            />
          </svg>
        )}
      </button>

      {/* End call */}
      <button
        onClick={handleEnd}
        className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/15 border border-red-500/25 hover:bg-red-500/25 transition-all duration-300"
      >
        <svg
          className="w-4 h-4 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 3.75 18 6m0 0 2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m-10.5 8.5a14.13 14.13 0 0 0 4.5 4.5l1.37-.91a1.5 1.5 0 0 1 1.65-.15l3.19 1.6a1.5 1.5 0 0 1 .83 1.34V22a1.5 1.5 0 0 1-1.63 1.49A19.5 19.5 0 0 1 2.51 5.63 1.5 1.5 0 0 1 4 4h1.37a1.5 1.5 0 0 1 1.34.83l1.6 3.19a1.5 1.5 0 0 1-.15 1.65l-.91 1.37Z"
          />
        </svg>
        <span className="text-xs text-red-400 font-semibold font-body">
          End Call
        </span>
      </button>
    </motion.div>
  );
}
