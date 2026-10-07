export type ViewSource = "demo" | "camera" | "upload";

export type ViewSnapshot = {
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: number;
  revision: string;
  source: ViewSource;
};

export type EvidenceRegion = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualCheck = {
  id: "paper" | "cover" | "usb" | "test_print";
  state: "observed" | "needs_attention" | "not_visible";
  evidence: string;
};

export type VisualGuide = {
  viewRevision: string;
  observation: string;
  nextStep: string;
  status: "needs_action" | "ready_to_test" | "verified" | "uncertain";
  checks: VisualCheck[];
  regions: EvidenceRegion[];
};

export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "ended" | "error";

export type TranscriptLine = { id: string; role: "user" | "assistant"; text: string };

export type SessionConfig = {
  liveEnabled: boolean;
  model: string;
  maxSessionSeconds: number;
  maxImageBytes: number;
  unavailableReason: string | null;
};
