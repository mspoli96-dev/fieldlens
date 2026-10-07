"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionConfig, TranscriptLine, ViewSnapshot, VisualGuide, VoiceStatus } from "@/lib/contracts";
import { prepareSnapshot } from "@/lib/client-snapshot";
import { visualGuideSchema } from "@/lib/guide-schema";

type PendingTurn = { text: string; snapshot?: ViewSnapshot; id: string };
type WireEvent = Record<string, unknown>;

function stringField(event: WireEvent, name: string): string {
  return typeof event[name] === "string" ? event[name] as string : "";
}

function waitForIce(connection: RTCPeerConnection): Promise<void> {
  if (connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { connection.removeEventListener("icegatheringstatechange", check); reject(new Error("Connection preparation timed out. Please try again.")); }, 12_000);
    function check() {
      if (connection.iceGatheringState !== "complete") return;
      clearTimeout(timer);
      connection.removeEventListener("icegatheringstatechange", check);
      resolve();
    }
    connection.addEventListener("icegatheringstatechange", check);
  });
}

export function useFieldLensSession() {
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [guide, setGuide] = useState<VisualGuide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [viewRequested, setViewRequested] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const eventsRef = useRef<RTCDataChannel | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const configRef = useRef<SessionConfig | null>(null);
  const generationRef = useRef(0);
  const respondingRef = useRef(false);
  const cancellationRef = useRef(false);
  const pumpingRef = useRef(false);
  const pendingRef = useRef<PendingTurn | null>(null);
  const latestFrameRef = useRef<ViewSnapshot | null>(null);
  const frameItemRef = useRef<string | null>(null);
  const toolCallsRef = useRef(new Set<string>());
  const pumpRef = useRef<() => Promise<void>>(async () => {});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    fetch("/api/config", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const value: SessionConfig = await response.json();
        if (typeof value.liveEnabled !== "boolean" || typeof value.model !== "string") throw new Error();
        configRef.current = value;
        setConfig(value);
      })
      .catch(() => { if (!controller.signal.aborted) setError("The session settings could not load. Refresh the page to try again."); });
    return () => { mountedRef.current = false; controller.abort(); };
  }, []);

  const appendTranscript = useCallback((id: string, role: TranscriptLine["role"], text: string, replace = false) => {
    setTranscript((lines) => {
      const previous = lines.find((line) => line.id === id);
      if (!previous) return [...lines, { id, role, text }].slice(-40);
      return lines.map((line) => line.id === id ? { ...line, text: replace ? text : `${line.text}${text}` } : line);
    });
  }, []);

  const sendEvent = useCallback((event: WireEvent) => {
    const channel = eventsRef.current;
    if (!channel || channel.readyState !== "open") throw new Error("Connect the assistant before sharing a view.");
    const payload = JSON.stringify(event);
    const negotiated = connectionRef.current?.sctp?.maxMessageSize ?? 65_536;
    const maximum = negotiated > 0 ? Math.min(negotiated, 262_144) : 65_536;
    if (new TextEncoder().encode(payload).byteLength > maximum) throw new Error("This view is too large for the connection. Try a closer view.");
    channel.send(payload);
  }, []);

  const end = useCallback(() => {
    generationRef.current++;
    requestRef.current?.abort();
    requestRef.current = null;
    if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    expiryTimerRef.current = null;
    connectTimerRef.current = null;
    eventsRef.current?.close();
    eventsRef.current = null;
    connectionRef.current?.close();
    connectionRef.current = null;
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
    audioRef.current = null;
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    if (sessionId) void fetch("/api/session/end", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }), keepalive: true,
    }).catch(() => {});
    pendingRef.current = null;
    respondingRef.current = false;
    cancellationRef.current = false;
    pumpingRef.current = false;
    latestFrameRef.current = null;
    frameItemRef.current = null;
    toolCallsRef.current.clear();
    if (mountedRef.current) { setStatus("ended"); setRemainingSeconds(0); setViewRequested(false); setAudioBlocked(false); }
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", end);
    return () => { window.removeEventListener("pagehide", end); end(); };
  }, [end]);

  pumpRef.current = async () => {
    if (pumpingRef.current || !pendingRef.current || eventsRef.current?.readyState !== "open") return;
    if (respondingRef.current) {
      if (!cancellationRef.current) {
        cancellationRef.current = true;
        sendEvent({ type: "response.cancel" });
        sendEvent({ type: "output_audio_buffer.clear" });
      }
      return;
    }
    pumpingRef.current = true;
    const turn = pendingRef.current;
    const generation = generationRef.current;
    try {
      const snapshot = turn.snapshot ? await prepareSnapshot(turn.snapshot, Math.min(configRef.current?.maxImageBytes ?? 48_000, 48_000)) : undefined;
      if (generation !== generationRef.current || pendingRef.current?.id !== turn.id) return;
      pendingRef.current = null;
      if (snapshot) {
        if (frameItemRef.current) sendEvent({ type: "conversation.item.delete", item_id: frameItemRef.current });
        const frameId = `frame_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
        sendEvent({ type: "conversation.item.create", item: {
          id: frameId, type: "message", role: "user", content: [
            { type: "input_text", text: `Shared view revision: ${snapshot.revision}. Source: ${snapshot.source}. This is the latest view. Use this exact revision in visual guidance. It supersedes previous images.` },
            { type: "input_image", image_url: snapshot.dataUrl },
          ],
        } });
        frameItemRef.current = frameId;
        latestFrameRef.current = snapshot;
        setViewRequested(false);
      }
      const messageId = `user_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
      sendEvent({ type: "conversation.item.create", item: { id: messageId, type: "message", role: "user", content: [{ type: "input_text", text: turn.text.slice(0, 1_000) }] } });
      appendTranscript(messageId, "user", turn.text.slice(0, 1_000));
      respondingRef.current = true;
      sendEvent({ type: "response.create" });
      setStatus("thinking");
    } catch {
      setError("That view could not be shared. Try a closer frame or reconnect the assistant.");
      pendingRef.current = null;
    } finally {
      pumpingRef.current = false;
      if (pendingRef.current && !respondingRef.current) void pumpRef.current();
    }
  };

  const processEvent = useCallback((event: WireEvent) => {
    const type = stringField(event, "type");
    if (type === "response.created") { respondingRef.current = true; setStatus("thinking"); }
    if (type === "input_audio_buffer.speech_started") setStatus("listening");
    if (type === "output_audio_buffer.started") setStatus("speaking");
    if (type === "output_audio_buffer.stopped") setStatus("listening");
    if (type === "response.output_audio_transcript.delta" || type === "response.output_text.delta") {
      appendTranscript(stringField(event, "item_id") || stringField(event, "response_id"), "assistant", stringField(event, "delta"));
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      appendTranscript(stringField(event, "item_id"), "user", stringField(event, "transcript"), true);
    }
    if (type === "response.function_call_arguments.done") {
      const callId = stringField(event, "call_id");
      if (!callId || toolCallsRef.current.has(callId)) return;
      toolCallsRef.current.add(callId);
      let output: Record<string, unknown> = { accepted: false, reason: "Unknown tool" };
      if (event.name === "update_visual_guide") {
        try {
          const parsed = visualGuideSchema.safeParse(JSON.parse(stringField(event, "arguments")));
          if (!parsed.success) output = { accepted: false, reason: "Invalid visual guidance. Use the documented schema and normalized regions." };
          else if (parsed.data.viewRevision !== latestFrameRef.current?.revision) output = { accepted: false, reason: "The guidance refers to an older or unknown view. Inspect the latest shared revision." };
          else { setGuide(parsed.data); output = { accepted: true, viewRevision: parsed.data.viewRevision }; }
        } catch { output = { accepted: false, reason: "Invalid tool arguments" }; }
      } else if (event.name === "request_current_view") {
        setViewRequested(true);
        output = { accepted: true, status: "waiting_for_user_to_share_a_frame", message: "Ask the visitor to select Share current view. No new image is available yet." };
      }
      sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) } });
    }
    if (type === "response.done") {
      respondingRef.current = false;
      cancellationRef.current = false;
      const response = event.response as { status?: string; output?: { type?: string }[] } | undefined;
      if (pendingRef.current) void pumpRef.current();
      else if (response?.status === "completed" && response.output?.some((item) => item.type === "function_call")) {
        respondingRef.current = true;
        sendEvent({ type: "response.create", response: { tool_choice: "none", instructions: "Explain the visual tool result to the visitor in one short English next step. Do not invent a completed action or unseen detail." } });
      } else if (response?.status === "failed") {
        setError("The assistant could not finish that response. Please try a shorter question.");
        setStatus("listening");
      } else setStatus("listening");
    }
    if (type === "error") {
      const detail = event.error as { code?: string } | undefined;
      if (detail?.code === "response_cancel_not_active") return;
      respondingRef.current = false;
      cancellationRef.current = false;
      setError("The assistant connection encountered a problem. End this session and reconnect if it continues.");
    }
  }, [appendTranscript, sendEvent]);

  const start = useCallback(async (snapshot: ViewSnapshot, withMicrophone: boolean) => {
    if (!configRef.current?.liveEnabled) { setError(configRef.current?.unavailableReason ?? "Live assistance is not available yet. You can explore the interactive bench."); return; }
    end();
    const generation = generationRef.current;
    setStatus("connecting"); setError(null); setTranscript([]); setGuide(null);
    const abort = new AbortController();
    requestRef.current = abort;
    try {
      const prepared = await prepareSnapshot(snapshot, Math.min(configRef.current.maxImageBytes, 48_000));
      if (generation !== generationRef.current) return;
      let microphone: MediaStream | null = null;
      if (withMicrophone) {
        microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (generation !== generationRef.current) { microphone.getTracks().forEach((track) => track.stop()); return; }
        microphoneRef.current = microphone;
      }
      const connection = new RTCPeerConnection();
      connectionRef.current = connection;
      const playback = new Audio(); playback.autoplay = true;
      audioRef.current = playback;
      connection.ontrack = (event) => {
        if (generation !== generationRef.current) return;
        playback.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void playback.play().catch(() => setAudioBlocked(true));
      };
      if (microphone) microphone.getAudioTracks().forEach((track) => connection.addTrack(track, microphone));
      else connection.addTransceiver("audio", { direction: "recvonly" });
      const events = connection.createDataChannel("oai-events"); eventsRef.current = events;
      events.onmessage = (message) => {
        if (generation !== generationRef.current || typeof message.data !== "string") return;
        try { processEvent(JSON.parse(message.data)); } catch { setError("An assistant update could not be displayed. Please share the view again."); }
      };
      events.onopen = () => {
        if (generation !== generationRef.current) return;
        if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
        setStatus("listening");
        pendingRef.current = { text: "Help me prepare this printer for a test print. Inspect the shared view, update the visual guide, and give me one clear next step.", snapshot: prepared, id: crypto.randomUUID() };
        void pumpRef.current();
      };
      events.onclose = () => {
        if (generation !== generationRef.current) return;
        end();
      };
      connection.onconnectionstatechange = () => {
        if (generation !== generationRef.current) return;
        if (connection.connectionState === "failed") { end(); setError("The voice connection was interrupted. Please reconnect."); setStatus("error"); }
      };
      const offer = await connection.createOffer(); await connection.setLocalDescription(offer); await waitForIce(connection);
      if (generation !== generationRef.current) return;
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdp: connection.localDescription?.sdp, consent: true }), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "A session could not be started. Please try again later.");
      if (typeof result.sessionId !== "string" || typeof result.sdp !== "string" || typeof result.expiresAt !== "number") throw new Error("The connection response was incomplete.");
      if (generation !== generationRef.current) {
        void fetch("/api/session/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: result.sessionId }), keepalive: true }).catch(() => {});
        return;
      }
      sessionIdRef.current = result.sessionId;
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((result.expiresAt - Date.now()) / 1_000));
        setRemainingSeconds(remaining);
        if (remaining === 0) end();
      };
      updateCountdown();
      expiryTimerRef.current = setInterval(updateCountdown, 1_000);
      connectTimerRef.current = setTimeout(() => { if (generation === generationRef.current) { end(); setError("The connection timed out. Please try again."); setStatus("error"); } }, 20_000);
      await connection.setRemoteDescription({ type: "answer", sdp: result.sdp });
    } catch (cause) {
      if (generation !== generationRef.current) return;
      end();
      setStatus("error");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Microphone access was not granted. You can connect using text instead." : cause instanceof Error && !/fetch|network|sdp|rtc|ice/i.test(cause.message) ? cause.message : "The assistant could not connect. Check your connection and try again.");
    }
  }, [end, processEvent]);

  const sendText = useCallback((text: string, snapshot?: ViewSnapshot) => {
    if (!text.trim()) return;
    if (eventsRef.current?.readyState !== "open") { setError("Connect the assistant before asking a question."); return; }
    pendingRef.current = { text: text.trim().slice(0, 1_000), snapshot, id: crypto.randomUUID() };
    setError(null);
    void pumpRef.current();
  }, []);

  const shareView = useCallback((snapshot: ViewSnapshot) => {
    sendText("Please check this new view and update the visual guide. What is the next step?", snapshot);
  }, [sendText]);

  const resumeAudio = useCallback(() => {
    void audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setError("This browser could not play the assistant audio. You can follow the transcript."));
  }, []);

  return { config, status, transcript, guide, error, remainingSeconds, viewRequested, audioBlocked, resumeAudio, start, end, shareView, sendText, clearError: () => setError(null) };
}
