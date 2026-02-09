"use client";

/* ------------------------------------------------------------------
 * Main page — Orchestrates the welcome screen ↔ LiveKit room flow.
 *
 * Design direction: "Obsidian & Amber" — a luxe dark theme with
 * warm amber accents, grain texture, glass-morphism panels, and
 * refined typography (Instrument Serif + Plus Jakarta Sans).
 * ------------------------------------------------------------------ */

import { useState, useCallback, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";

import { getToken } from "@/lib/api";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { ChatPanel } from "@/components/ChatPanel";
import { SummaryPanel } from "@/components/SummaryPanel";
import { Controls } from "@/components/Controls";
import { useTranscript } from "@/hooks/useTranscript";
import { useCallSummary } from "@/hooks/useCallSummary";

import type { AgentState, ConnectionPhase, CallSummary } from "@/lib/types";

/* ================================================================== */
/*  Root page component                                               */
/* ================================================================== */

export default function Home() {
  const [phase, setPhase] = useState<ConnectionPhase>("welcome");
  const [token, setToken] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* Persisted summary so it survives room unmount */
  const [savedSummary, setSavedSummary] = useState<CallSummary | null>(null);

  const handleConnect = useCallback(async () => {
    setPhase("connecting");
    setError(null);
    setSavedSummary(null);
    try {
      const data = await getToken();
      setToken(data.token);
      setLivekitUrl(data.livekit_url);
      setPhase("room");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setPhase("welcome");
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setToken("");
    setLivekitUrl("");
    /* If we got a summary, stay on a recap screen; otherwise go home */
    if (!savedSummary) setPhase("welcome");
  }, [savedSummary]);

  const handleReturnHome = useCallback(() => {
    setSavedSummary(null);
    setPhase("welcome");
  }, []);

  /* ---- Welcome / connecting screen ---- */
  if (phase === "welcome" || phase === "connecting") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="welcome"
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.3 }}
        >
          <WelcomeScreen
            onConnect={handleConnect}
            isConnecting={phase === "connecting"}
            error={error}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  /* ---- Active room ---- */
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="room"
        className="h-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={token}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={handleDisconnect}
          className="h-full"
        >
          <RoomContent
            onDisconnect={handleDisconnect}
            onSummaryReceived={setSavedSummary}
            onReturnHome={handleReturnHome}
          />
        </LiveKitRoom>
      </motion.div>
    </AnimatePresence>
  );
}

/* ================================================================== */
/*  Welcome screen                                                    */
/* ================================================================== */

function WelcomeScreen({
  onConnect,
  isConnecting,
  error,
}: {
  onConnect: () => void;
  isConnecting: boolean;
  error: string | null;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      {/* ---- Ambient background ---- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[700px] h-[700px] rounded-full bg-accent/[0.035] blur-[140px]" />
      </div>

      {/* ---- Decorative grid lines ---- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[22%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.035] to-transparent" />
        <div className="absolute top-[78%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.035] to-transparent" />
        <div className="absolute top-0 left-[22%] h-full w-px bg-gradient-to-b from-transparent via-white/[0.025] to-transparent" />
        <div className="absolute top-0 right-[22%] h-full w-px bg-gradient-to-b from-transparent via-white/[0.025] to-transparent" />
      </div>

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Brand */}
        <motion.h1
          className="text-6xl md:text-8xl font-display tracking-tight mb-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8 }}
        >
          <span className="bg-gradient-to-r from-accent-light via-accent to-accent-dark bg-clip-text text-transparent">
            SuperBryn
          </span>
        </motion.h1>

        <motion.p
          className="text-[11px] tracking-[0.35em] uppercase text-zinc-500 mb-14 font-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          AI Voice Assistant
        </motion.p>

        {/* Separator */}
        <motion.div
          className="w-20 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent mb-14"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        />

        {/* CTA */}
        <motion.button
          onClick={onConnect}
          disabled={isConnecting}
          className="group relative"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Outer pulse */}
          {!isConnecting && (
            <div className="absolute -inset-4 rounded-full bg-accent/[0.06] animate-pulse-slow" />
          )}

          <div className="relative flex items-center gap-3 px-8 py-4 rounded-full bg-accent/[0.08] border border-accent/25 hover:bg-accent/[0.15] hover:border-accent/40 transition-all duration-500 backdrop-blur-sm">
            {isConnecting ? (
              <svg
                className="w-5 h-5 text-accent animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-accent"
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
            <span className="text-accent font-semibold font-body text-sm">
              {isConnecting ? "Connecting…" : "Start Conversation"}
            </span>
          </div>
        </motion.button>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              className="mt-6 text-xs text-red-400 font-body max-w-xs text-center"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Tagline */}
        <motion.p
          className="mt-14 text-[11px] text-zinc-600 max-w-xs text-center leading-relaxed font-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75 }}
        >
          Book, modify, and manage your appointments with a natural voice
          conversation
        </motion.p>
      </motion.div>
    </div>
  );
}

/* ================================================================== */
/*  Room content — rendered inside LiveKitRoom                        */
/* ================================================================== */

function RoomContent({
  onDisconnect,
  onSummaryReceived,
  onReturnHome,
}: {
  onDisconnect: () => void;
  onSummaryReceived: (s: CallSummary) => void;
  onReturnHome: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"chat" | "summary">("chat");
  const transcript = useTranscript();
  const summary = useCallSummary();
  const connectionState = useConnectionState();

  /* Track disconnection */
  const isDisconnected = connectionState === ConnectionState.Disconnected;

  /* Agent state via useVoiceAssistant —
     returns "disconnected" until an agent joins the room. */
  const va = useVoiceAssistant();
  const agentState: AgentState = (va.state as AgentState) || "connecting";

  /* Switch to summary tab when summary arrives */
  useEffect(() => {
    if (summary) {
      setActiveTab("summary");
      onSummaryReceived(summary);
    }
  }, [summary, onSummaryReceived]);

  return (
    <div className="relative flex h-full bg-obsidian">
      {/* ================================================================ */}
      {/*  Left — Avatar                                                   */}
      {/* ================================================================ */}
      <motion.div
        className="flex-1 flex items-center justify-center p-6 min-w-0"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <AvatarDisplay agentState={agentState} />
      </motion.div>

      {/* ================================================================ */}
      {/*  Right — Side panel                                              */}
      {/* ================================================================ */}
      <motion.div
        className="w-[380px] lg:w-[420px] flex flex-col border-l border-white/[0.06] bg-obsidian-50/40 backdrop-blur-sm shrink-0"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <h2 className="text-xl font-display text-accent">SuperBryn</h2>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-[6px] h-[6px] rounded-full ${
                isDisconnected ? "bg-zinc-500" : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span className="text-[10px] text-zinc-500 font-body">
              {isDisconnected ? "Disconnected" : "Connected"}
            </span>
          </div>
        </div>

        {/* ---- Tab switcher ---- */}
        <div className="px-4 pt-3">
          <div className="relative flex bg-white/[0.03] rounded-lg p-0.5">
            {/* Animated background pill */}
            <motion.div
              className="absolute top-0.5 bottom-0.5 rounded-md bg-white/[0.07]"
              animate={{
                left: activeTab === "chat" ? 2 : "50%",
                right: activeTab === "summary" ? 2 : "50%",
              }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />

            <button
              onClick={() => setActiveTab("chat")}
              className={`relative z-10 flex-1 py-2 text-[11px] font-semibold rounded-md transition-colors duration-200 font-body ${
                activeTab === "chat"
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab("summary")}
              className={`relative z-10 flex-1 py-2 text-[11px] font-semibold rounded-md transition-colors duration-200 font-body flex items-center justify-center gap-1.5 ${
                activeTab === "summary"
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Summary
              {summary && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* ---- Tab content ---- */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === "chat" ? (
              <motion.div
                key="chat-tab"
                className="h-full"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ChatPanel messages={transcript} agentState={agentState} />
              </motion.div>
            ) : (
              <motion.div
                key="summary-tab"
                className="h-full"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
              >
                <SummaryPanel summary={summary} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---- Controls ---- */}
        <div className="border-t border-white/[0.06]">
          {isDisconnected ? (
            <motion.div
              className="flex justify-center py-4 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <button
                onClick={onReturnHome}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/[0.1] border border-accent/25 hover:bg-accent/[0.18] transition-all duration-300 font-body text-xs text-accent font-semibold"
              >
                <svg
                  className="w-4 h-4"
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
                New Conversation
              </button>
            </motion.div>
          ) : (
            <Controls onDisconnect={onDisconnect} />
          )}
        </div>
      </motion.div>

      {/* ---- Audio renderer (invisible, plays all remote audio) ---- */}
      <RoomAudioRenderer />
    </div>
  );
}
