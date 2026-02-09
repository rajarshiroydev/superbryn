"use client";

/* ------------------------------------------------------------------
 * AvatarDisplay — Renders the Tavus avatar video track with ambient
 *                 glow effects and agent-state indicators.
 * ------------------------------------------------------------------ */

import { useTracks } from "@livekit/components-react";
import { VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/types";

interface Props {
  agentState: AgentState;
}

export function AvatarDisplay({ agentState }: Props) {
  /* Find the remote (Tavus) video track */
  const videoTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true },
  );
  const avatarTrack = videoTracks.find((t) => !t.participant.isLocal);

  const isSpeaking = agentState === "speaking";
  const isThinking = agentState === "thinking";

  return (
    <div className="relative flex items-center justify-center h-full w-full select-none">
      {/* -------- Ambient glow -------- */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "70%",
          paddingBottom: "45%",
          background:
            "radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={{
          opacity: isSpeaking ? 1 : 0.35,
          scale: isSpeaking ? 1.08 : 1,
        }}
        transition={{ duration: 1.8, repeat: Infinity, repeatType: "reverse" }}
      />

      {/* -------- Decorative ring -------- */}
      <div
        className={`absolute w-[88%] max-w-[620px] aspect-video rounded-[28px] pointer-events-none transition-all duration-1000 ${
          isSpeaking ? "animate-speaking-ring" : "shadow-[0_0_0_0_transparent]"
        }`}
      />

      {/* -------- Video container -------- */}
      <div
        className={`relative w-[88%] max-w-[600px] aspect-video rounded-2xl overflow-hidden transition-all duration-700 ${
          isSpeaking
            ? "border border-accent/25 shadow-[0_0_60px_rgba(245,158,11,0.15)]"
            : "border border-white/[0.06] shadow-[0_0_40px_rgba(0,0,0,0.4)]"
        }`}
      >
        {avatarTrack ? (
          <VideoTrack
            trackRef={avatarTrack}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Placeholder while avatar loads */
          <div className="w-full h-full flex items-center justify-center bg-obsidian-50">
            <motion.div
              className="flex flex-col items-center gap-4"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-accent/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
              </div>
              <p className="text-sm text-zinc-500 font-body">
                Connecting to avatar…
              </p>
            </motion.div>
          </div>
        )}

        {/* -------- State badge overlay -------- */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <motion.div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium font-body backdrop-blur-md ${
              isSpeaking
                ? "bg-accent/20 text-accent-light border border-accent/20"
                : isThinking
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/15"
                  : agentState === "listening"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/15"
                    : "bg-white/10 text-white/50 border border-white/[0.06]"
            }`}
            key={agentState}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                isSpeaking
                  ? "bg-accent"
                  : isThinking
                    ? "bg-blue-400"
                    : agentState === "listening"
                      ? "bg-emerald-400"
                      : "bg-white/40"
              }`}
            />
            {isSpeaking
              ? "Speaking"
              : isThinking
                ? "Processing…"
                : agentState === "listening"
                  ? "Listening"
                  : agentState === "initializing"
                    ? "Initializing…"
                    : "Connecting…"}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
