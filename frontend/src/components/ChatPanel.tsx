"use client";

/* ------------------------------------------------------------------
 * ChatPanel — Displays transcription messages in a chat-bubble UI.
 *             Shows a processing indicator when the agent is thinking.
 * ------------------------------------------------------------------ */

import { useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TranscriptMessage, AgentState, ToolCallEvent } from "@/lib/types";

interface Props {
  messages: TranscriptMessage[];
  toolCalls: ToolCallEvent[];
  agentState: AgentState;
}

const TOOL_META: Record<
  string,
  { label: string; icon: string; accent: string }
> = {
  identify_user: {
    label: "User Identified",
    icon: "\u{1F464}",
    accent: "purple",
  },
  fetch_slots: { label: "Slots Fetched", icon: "\u{1F4C5}", accent: "blue" },
  book_appointment: {
    label: "Appointment Booked",
    icon: "\u2705",
    accent: "emerald",
  },
  retrieve_appointments: {
    label: "Appointments Retrieved",
    icon: "\u{1F4CB}",
    accent: "blue",
  },
  cancel_appointment: {
    label: "Appointment Cancelled",
    icon: "\u{1F6AB}",
    accent: "red",
  },
  modify_appointment: {
    label: "Appointment Modified",
    icon: "\u270F\uFE0F",
    accent: "amber",
  },
  end_conversation: { label: "Call Ended", icon: "\u{1F44B}", accent: "zinc" },
};

const ACCENT_CLASSES: Record<string, string> = {
  purple: "bg-purple-500/[0.08] border-purple-500/[0.15] text-purple-300",
  blue: "bg-blue-500/[0.08] border-blue-500/[0.15] text-blue-300",
  emerald: "bg-emerald-500/[0.08] border-emerald-500/[0.15] text-emerald-300",
  red: "bg-red-500/[0.08] border-red-500/[0.15] text-red-300",
  amber: "bg-amber-500/[0.08] border-amber-500/[0.15] text-amber-300",
  zinc: "bg-zinc-500/[0.08] border-zinc-500/[0.15] text-zinc-300",
};

export function ChatPanel({ messages, toolCalls, agentState }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Build a merged timeline of messages and tool-call events */
  const timeline = useMemo(() => {
    const items: Array<
      | { kind: "message"; data: TranscriptMessage; ts: number }
      | { kind: "tool"; data: ToolCallEvent; ts: number }
    > = [
      ...messages.map((m) => ({
        kind: "message" as const,
        data: m,
        ts: m.timestamp,
      })),
      ...toolCalls.map((t) => ({
        kind: "tool" as const,
        data: t,
        ts: new Date(t.timestamp).getTime(),
      })),
    ];
    items.sort((a, b) => a.ts - b.ts);
    return items;
  }, [messages, toolCalls]);

  /* Auto-scroll to bottom */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [timeline, agentState]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto px-4 py-4 space-y-3 scroll-smooth"
    >
      {/* Empty state */}
      {timeline.length === 0 && agentState !== "thinking" && (
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

      {/* Timeline — messages & tool-call cards */}
      <AnimatePresence initial={false}>
        {timeline.map((item) => {
          if (item.kind === "message") {
            const msg = item.data;
            return (
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
                  <span
                    className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                      msg.speaker === "user"
                        ? "text-accent/60"
                        : "text-zinc-500"
                    }`}
                  >
                    {msg.speaker === "user" ? "You" : "Bryn"}
                  </span>
                  <p className="font-body">{msg.text}</p>
                </div>
              </motion.div>
            );
          }
          const tc = item.data;
          const meta = TOOL_META[tc.tool] || {
            label: tc.tool,
            icon: "\u26A1",
            accent: "zinc",
          };
          const accentCls = ACCENT_CLASSES[meta.accent] || ACCENT_CLASSES.zinc;
          return (
            <motion.div
              key={`tool-${tc.id}`}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex justify-center"
            >
              <div
                className={`inline-flex items-start gap-2.5 max-w-[90%] px-3.5 py-2.5 rounded-xl border text-[12px] font-body ${accentCls}`}
              >
                <span className="text-sm leading-none mt-0.5">{meta.icon}</span>
                <div className="min-w-0">
                  <span className="font-semibold text-[11px] uppercase tracking-wider block">
                    {meta.label}
                  </span>
                  <span className="text-[11px] opacity-70 leading-snug block mt-0.5">
                    {tc.action}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
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
