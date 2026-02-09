"use client";

/* ------------------------------------------------------------------
 * SummaryPanel — Displays the structured call summary that the agent
 *                publishes at the end of a conversation.
 * ------------------------------------------------------------------ */

import { motion } from "framer-motion";
import type { CallSummary } from "@/lib/types";

interface Props {
  summary: CallSummary | null;
}

export function SummaryPanel({ summary }: Props) {
  /* ---- Empty state ---- */
  if (!summary) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
              />
            </svg>
          </div>
          <p className="text-xs text-zinc-500 font-body leading-relaxed max-w-[220px] mx-auto">
            A conversation summary will appear here once the call ends.
          </p>
        </div>
      </div>
    );
  }

  /* ---- Summary view ---- */
  return (
    <motion.div
      className="flex-1 overflow-y-auto p-4 space-y-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* -------- Main summary text -------- */}
      <div className="rounded-xl bg-accent/[0.06] border border-accent/[0.15] p-4">
        <h3 className="text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2.5 font-body">
          Call Summary
        </h3>
        <p className="text-[13px] text-zinc-200 leading-relaxed font-body">
          {summary.summary}
        </p>
      </div>

      {/* -------- Appointment actions -------- */}
      {summary.appointments && summary.appointments.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-3 font-body">
            Appointments
          </h3>
          <div className="space-y-2">
            {summary.appointments.map((appt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i }}
                className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3"
              >
                {/* Status badge */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full font-body uppercase tracking-wider ${
                      appt.action === "booked"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : appt.action === "cancelled"
                          ? "bg-red-500/15 text-red-400"
                          : appt.action === "modified"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-zinc-500/15 text-zinc-400"
                    }`}
                  >
                    {appt.action}
                  </span>
                </div>

                {/* Date/time details */}
                <div className="text-[13px] text-zinc-300 font-body">
                  {appt.date && <span>{appt.date}</span>}
                  {appt.time && (
                    <span className="text-zinc-400"> at {appt.time}</span>
                  )}
                  {appt.new_date && appt.new_time && (
                    <span className="text-blue-400">
                      {" "}
                      → {appt.new_date} at {appt.new_time}
                    </span>
                  )}
                </div>

                {appt.details && (
                  <p className="text-[11px] text-zinc-500 mt-1 font-body">
                    {appt.details}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* -------- Metadata -------- */}
      <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px] font-body">
          {summary.user_name && (
            <div>
              <span className="text-zinc-600">User</span>{" "}
              <span className="text-zinc-400">{summary.user_name}</span>
            </div>
          )}
          {summary.phone_number && (
            <div>
              <span className="text-zinc-600">Phone</span>{" "}
              <span className="text-zinc-400">{summary.phone_number}</span>
            </div>
          )}
          {summary.timestamp && (
            <div className="col-span-2">
              <span className="text-zinc-600">Ended</span>{" "}
              <span className="text-zinc-400">
                {new Date(summary.timestamp).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
