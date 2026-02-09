"use client";

/* ------------------------------------------------------------------
 * ChatPanel — Displays transcription messages in a chat-bubble UI.
 *             Shows a processing indicator when the agent is thinking.
 * ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TranscriptMessage, AgentState } from "@/lib/types";

interface Props {
  messages: TranscriptMessage[];
  agentState: AgentState;
}

export function ChatPanel({ messages, agentState }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom on new messages */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages, agentState]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth"
    >
      {/* Empty state */}
      {messages.length === 0 && agentState !== "thinking" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-full text-center"
        >
          <div className="w-12 h-12 rounded-full bg-accent/[0.06] flex items-center justify-center mb-3">
            <svg
              className="w-5 h-5 text-accent/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
              />
            </svg>
          </div>
          <p className="text-xs text-zinc-500 font-body leading-relaxed max-w-[200px]">
            Conversation transcript will appear here as you speak…
          </p>
        </motion.div>
      )}

      {/* Message bubbles */}
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`flex ${msg.speaker === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed transition-opacity duration-300 ${
                msg.speaker === "user"
                  ? "bg-accent/[0.12] text-amber-100/90 rounded-br-sm"
                  : "bg-white/[0.05] text-zinc-300 rounded-bl-sm"
              } ${!msg.isFinal ? "opacity-60" : "opacity-100"}`}
            >
              {/* Speaker label */}
              <span
                className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                  msg.speaker === "user" ? "text-accent/60" : "text-zinc-500"
                }`}
              >
                {msg.speaker === "user" ? "You" : "Bryn"}
              </span>
              <p className="font-body">{msg.text}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* -------- Thinking / tool-call indicator -------- */}
      <AnimatePresence>
        {agentState === "thinking" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-sm px-4 py-3 bg-blue-500/[0.08] border border-blue-500/[0.12]">
              {/* Animated dots */}
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue-400"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-blue-400/80 font-body font-medium">
                Processing request…
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
