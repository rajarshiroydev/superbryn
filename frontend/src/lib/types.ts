/* ------------------------------------------------------------------
 * TypeScript types shared across the frontend
 * ------------------------------------------------------------------ */

export interface TranscriptMessage {
  id: string;
  text: string;
  speaker: "user" | "agent";
  isFinal: boolean;
  timestamp: number;
}

export interface CallSummary {
  type: string;
  summary: string;
  appointments: AppointmentAction[];
  timestamp: string;
  phone_number: string | null;
  user_name: string | null;
}

export interface AppointmentAction {
  action: string;
  date: string;
  time: string;
  new_date?: string | null;
  new_time?: string | null;
  details: string;
}

export type AgentState =
  | "disconnected"
  | "connecting"
  | "initializing"
  | "listening"
  | "thinking"
  | "speaking";

export type ConnectionPhase = "welcome" | "connecting" | "room";
