"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, AudioLines, Box, Camera, Check, CheckCheck, ChevronDown, CircleAlert, CircleHelp, CirclePause, Code2, Eye, Focus, ImagePlus, Info, LoaderCircle, LockKeyhole, Maximize2, MessageSquare, Mic, MicOff, ScanLine, Send, Square, Volume2, X } from "lucide-react";
import { DemoBench, type DemoBenchHandle } from "@/components/demo-bench";
import { useFieldLensSession } from "@/hooks/use-fieldlens-session";
import { CONTACT_URL, CURRENT_VERTICAL } from "@/lib/brand";
import type { EvidenceRegion, ViewSnapshot, ViewSource, VisualCheck, VisualGuide, VoiceStatus } from "@/lib/contracts";

const activeStatuses: VoiceStatus[] = ["listening", "thinking", "speaking"];
const statusLabels: Record<VoiceStatus, string> = { idle: "Ready when you are", connecting: "Connecting…", listening: "Listening", thinking: "Looking at your view", speaking: "Speaking", ended: "Session complete", error: "Connection interrupted" };
const checkLabels: Record<VisualCheck["id"], string> = { paper: "Paper tray", cover: "Printer cover", usb: "USB connection", test_print: "Test page" };

function EvidenceFrame({ snapshot, regions = [], expanded = false }: { snapshot: ViewSnapshot; regions?: EvidenceRegion[]; expanded?: boolean }) {
  return <div className={`evidence-image ${expanded ? "expanded-evidence" : ""}`} style={{ aspectRatio: `${snapshot.width}/${snapshot.height}` }}><Image src={snapshot.dataUrl} alt="The view shared with the assistant" fill unoptimized sizes={expanded ? "90vw" : "380px"} />{regions.map((region, index) => {
    const left = Math.max(0, Math.min(1, region.x));
    const top = Math.max(0, Math.min(1, region.y));
    const width = Math.max(0, Math.min(region.width, 1 - left));
    const height = Math.max(0, Math.min(region.height, 1 - top));
    return <span key={`${region.label}-${index}`} className="evidence-region" title={region.label} style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: `${width * 100}%`, height: `${height * 100}%` }}><span>{index + 1}{expanded ? ` · ${region.label}` : ""}</span></span>;
  })}</div>;
}

function GuideChecks({ guide, readOnly = false }: { guide: VisualGuide; readOnly?: boolean }) {
  return <div className="guide-checks"><div className="section-micro-label">{readOnly ? "OBSERVED IN THE LAST SHARED VIEW" : "WHAT THE ASSISTANT CAN SEE"}</div><ul>{guide.checks.map((check) => <li key={check.id} className={`guide-check ${check.state}`}><span>{check.state === "observed" ? <Check size={13} /> : check.state === "needs_attention" ? <CircleAlert size={13} /> : <CircleHelp size={13} />}</span><div><strong>{checkLabels[check.id]}</strong><p>{check.evidence}</p></div><span className="check-status">{check.state === "observed" ? "Seen" : check.state === "needs_attention" ? "Review" : "Not visible"}</span></li>)}</ul></div>;
}

export function FieldLensApp({ repositoryUrl }: { repositoryUrl?: string }) {
  const session = useFieldLensSession();
  const [source, setSource] = useState<ViewSource>("demo");
  const [withMicrophone, setWithMicrophone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [benchReady, setBenchReady] = useState(false);
  const [currentRevision, setCurrentRevision] = useState("demo-initial");
  const [snapshot, setSnapshot] = useState<ViewSnapshot | null>(null);
  const [photo, setPhoto] = useState<{ url: string; name: string; width: number; height: number } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const benchRef = useRef<DemoBenchHandle>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const photoUrl = useRef<string | null>(null);
  const evidenceDialog = useRef<HTMLDialogElement>(null);
  const currentRevisionRef = useRef("demo-initial");
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const active = activeStatuses.includes(session.status);
  const connecting = session.status === "connecting";
  const hasSession = active || connecting;
  const hasRetainedReview = !hasSession && (session.status === "ended" || session.status === "error") && Boolean(session.guide || session.transcript.length);
  const matchingGuide = session.guide && snapshot && session.guide.viewRevision === snapshot.revision ? session.guide : null;
  const displayRegions: EvidenceRegion[] = !matchingGuide || !snapshot ? [] : snapshot.source === "demo"
    ? matchingGuide.checks.flatMap((check) => {
      const region = snapshot.demoRegions?.[check.id];
      return check.state !== "not_visible" && region ? [region] : [];
    })
    : matchingGuide.regions;
  const highlightDescription = snapshot?.source === "demo"
    ? "Demo parts highlighted from the assistant’s observations."
    : "Approximate assistant highlights.";
  const guideStale = Boolean(snapshot && (snapshot.source !== source || (source !== "camera" && currentRevision !== snapshot.revision)));
  const sourceReady = source === "demo" ? benchReady : source === "camera" ? cameraReady : Boolean(photo);
  const readyToStart = sourceReady && consent && session.config?.liveEnabled === true && !captureBusy && !hasSession;
  const latestAssistant = [...session.transcript].reverse().find((line) => line.role === "assistant");
  const timer = `${Math.floor(session.remainingSeconds / 60)}:${String(Math.max(0, session.remainingSeconds % 60)).padStart(2, "0")}`;
  const displayError = localError || session.error;

  const onBenchChanged = useCallback((revision: string) => {
    currentRevisionRef.current = revision;
    setCurrentRevision(revision);
  }, []);
  const onBenchReady = useCallback((ready: boolean) => setBenchReady(ready), []);

  useEffect(() => () => {
    cameraRequest.current += 1;
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
  }, []);
  useEffect(() => { if (active && transcriptOpen) transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [active, session.transcript, transcriptOpen]);

  const stopCamera = useCallback(() => {
    cameraRequest.current += 1;
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraPending(false);
  }, []);

  useEffect(() => {
    if (session.status === "ended" || session.status === "error") {
      stopCamera();
      setMessage("");
      setConsent(false);
      setTranscriptOpen(true);
    }
  }, [session.status, stopCamera]);

  function changeSource(nextSource: ViewSource) {
    if (nextSource !== "camera") stopCamera();
    setSource(nextSource);
    setLocalError(null);
    if (nextSource === "demo") setCurrentRevision(currentRevisionRef.current);
    else { const revision = `${nextSource}-${crypto.randomUUID()}`; setCurrentRevision(revision); }
  }

  async function enableCamera() {
    changeSource("camera");
    if (cameraStream.current) return;
    const requestId = ++cameraRequest.current;
    setCameraPending(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable. Try a photo or the interactive demo instead.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (requestId !== cameraRequest.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      cameraStream.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraReady(true);
      setAnnouncement("Camera preview started. Images are shared only when you choose to share a view.");
    } catch (error) {
      if (requestId !== cameraRequest.current) return;
      stopCamera();
      setLocalError(error instanceof DOMException && error.name === "NotAllowedError" ? "Camera permission was not granted. You can use a photo or the interactive demo." : error instanceof Error ? error.message : "The camera could not start.");
    } finally { if (requestId === cameraRequest.current) setCameraPending(false); }
  }

  function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setLocalError("Choose a JPEG, PNG, or WebP image."); return; }
    if (file.size > 10_000_000) { setLocalError("Choose an image smaller than 10 MB."); return; }
    changeSource("upload");
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    const url = URL.createObjectURL(file);
    photoUrl.current = url;
    setPhoto({ url, name: file.name, width: 16, height: 10 });
    setAnnouncement("Photo selected. It has not been shared with the assistant.");
  }

  async function captureView(): Promise<ViewSnapshot> {
    if (source === "demo") {
      if (!benchRef.current) throw new Error("The interactive demo is still loading.");
      return benchRef.current.capture();
    }
    const element = source === "camera" ? videoRef.current : imageRef.current;
    if (!element) throw new Error("Choose a photo or start the camera before sharing a view.");
    const sourceWidth = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
    const sourceHeight = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("The image is still loading. Please try again.");
    const scale = Math.min(1, 1024 / sourceWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not capture the view.");
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length * 0.75 > 256_000 && quality > 0.25) { quality -= 0.1; dataUrl = canvas.toDataURL("image/jpeg", quality); }
    if (dataUrl.length * 0.75 > 256_000) throw new Error("This image has too much detail to share. Try a closer crop or a smaller photo.");
    const revision = source === "camera" ? `camera-${crypto.randomUUID()}` : currentRevision;
    setCurrentRevision(revision);
    return { dataUrl, width: canvas.width, height: canvas.height, capturedAt: Date.now(), revision, source };
  }

  async function startSession() {
    if (!readyToStart) return;
    setLocalError(null);
    setCaptureBusy(true);
    try { const frame = await captureView(); setSnapshot(frame); await session.start(frame, withMicrophone); }
    catch (error) { setLocalError(error instanceof Error ? error.message : "The session could not start."); }
    finally { setCaptureBusy(false); }
  }

  async function shareCurrentView() {
    if (!active || captureBusy || !sourceReady) return;
    setCaptureBusy(true);
    setLocalError(null);
    try { const frame = await captureView(); setSnapshot(frame); session.shareView(frame); setAnnouncement("Current view shared. Waiting for the assistant to inspect it."); }
    catch (error) { setLocalError(error instanceof Error ? error.message : "The view could not be shared."); }
    finally { setCaptureBusy(false); }
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || !active) return;
    session.sendText(message.trim());
    setMessage("");
  }

  return (
    <>
      <a href="#workbench" className="skip-link">Skip to the workbench</a>
      <header className="site-header page-width"><a className="brand" href="#"><span className="brand-icon"><Focus size={23} strokeWidth={1.7} aria-hidden="true" /></span><span className="brand-name">FieldLens<span className="brand-by">BY WEBYTEX</span></span></a><span className="vertical-label" style={{ backgroundColor: CURRENT_VERTICAL.colour }}><span />{CURRENT_VERTICAL.label}</span><nav aria-label="Main navigation"><a href="#how-it-works" className="how-link">How it works</a>{repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noreferrer" className="source-link" aria-label="View source code"><Code2 size={15} aria-hidden="true" /><span>View source</span><ArrowUpRight size={12} aria-hidden="true" /></a> : null}<a className="contact-link" aria-label="Contact Webytex" href={CONTACT_URL} target="_blank" rel="noreferrer">Let’s talk <ArrowUpRight size={14} aria-hidden="true" /></a></nav></header>

      <main className="page-width">
        <section className="intro" aria-labelledby="page-title"><div><p className="eyebrow"><span className="intro-dot" /> VISUAL INTELLIGENCE. PRACTICAL ASSISTANCE.</p><h1 id="page-title">See the problem.<br /><span>Take the next step.</span></h1><p>Give your support conversation a pair of eyes.<br className="desktop-break" /> Share a view, talk it through, and check what changed.</p></div><div className="intro-side"><div className="capability-label"><Eye size={15} /><span>Vision</span><span className="capability-divider">+</span><AudioLines size={16} /><span>Voice</span></div><p>A small support scenario.<br />A different kind of conversation.</p><span className="prototype-badge"><span /> INTERACTIVE PROTOTYPE</span></div></section>

        <section className="workbench" id="workbench" aria-label="FieldLens visual support workbench">
          <div className="workbench-topline"><div className="workbench-title"><span className="tiny-mark" /><span>SUPPORT WORKBENCH</span><span className="workbench-version">01</span></div><span className={`session-indicator ${active ? "is-live" : ""}`}><span />{active ? "Session active" : connecting ? "Connecting" : hasRetainedReview ? "Session complete" : "No active session"}{active ? <span className="session-time">{timer}</span> : null}</span></div>
          <div className="workbench-grid">
            <section className="visual-panel" aria-label="Device view">
              <div className="view-toolbar"><div className="source-tabs" role="group" aria-label="Choose view source"><button className={source === "demo" ? "selected" : ""} aria-pressed={source === "demo"} onClick={() => changeSource("demo")}><Box size={14} />Interactive demo</button><button className={source === "camera" ? "selected" : ""} aria-pressed={source === "camera"} onClick={() => changeSource("camera")}><Camera size={14} />Camera</button><button className={source === "upload" ? "selected" : ""} aria-pressed={source === "upload"} onClick={() => { changeSource("upload"); fileRef.current?.click(); }}><ImagePlus size={14} />Photo</button></div><span className="viewport-label">YOUR VIEW</span></div>
              {source === "demo" ? <div className="device-intro"><span className="device-id">FL-01</span><div><h2>Desk printer</h2><p>Get the fictional printer ready for a test page.</p></div><span className="fictional-badge">FICTIONAL</span></div> : <div className="device-intro"><span className="device-id">{source === "camera" ? <Camera size={19} /> : <ImagePlus size={19} />}</span><div><h2>{source === "camera" ? "Your camera" : "Your photo"}</h2><p>{source === "camera" ? "Preview stays local until you share a frame." : photo ? photo.name : "Choose a clear image of the device."}</p></div></div>}

              <div className={source === "demo" ? "demo-container" : "demo-container visually-parked"}><DemoBench ref={benchRef} onViewChange={onBenchChanged} onReady={onBenchReady} /></div>
              {source === "camera" ? <div className="camera-container"><div className={`camera-stage ${cameraReady ? "camera-is-ready" : ""}`}><video ref={videoRef} playsInline muted autoPlay aria-label="Your local camera preview" onLoadedData={() => setCameraReady(true)} />{!cameraReady ? <div className="media-placeholder"><span><Camera size={30} strokeWidth={1.2} /></span><h3>Bring your own view.</h3><p>Point your camera at a device. You decide which still images to share with the assistant.</p><button className="button button-dark" onClick={enableCamera} disabled={cameraPending}>{cameraPending ? <LoaderCircle size={15} className="spin" /> : <Camera size={15} />}{cameraPending ? "Opening camera…" : "Enable camera"}</button><small>No camera audio is captured here.</small></div> : <div className="camera-live-tag"><span />LOCAL PREVIEW</div>}</div>{cameraReady ? <div className="camera-footer"><span><LockKeyhole size={12} />Only selected frames are shared</span><button onClick={stopCamera}><Square size={11} />Stop camera</button></div> : null}</div> : null}
              {source === "upload" ? <div className="photo-container">{photo ? <><div className="photo-stage"><Image ref={imageRef} src={photo.url} alt="Your selected device photo, not yet shared unless you started a session or shared a view" fill unoptimized sizes="(max-width: 850px) 95vw, 800px" onLoad={(event) => { const img = event.currentTarget; setPhoto((current) => current ? { ...current, width: img.naturalWidth, height: img.naturalHeight } : null); }} onError={() => setLocalError("This image could not be opened. Please choose another JPEG, PNG, or WebP file.")} /></div><div className="camera-footer"><span><LockKeyhole size={12} />Share only photos you have permission to use</span><button onClick={() => fileRef.current?.click()}><ImagePlus size={13} />Change photo</button></div></> : <div className="media-placeholder photo-placeholder"><span><ImagePlus size={31} strokeWidth={1.2} /></span><h3>A photo is enough to start.</h3><p>Choose an image without personal information. The assistant will work from what is visible.</p><button className="button button-dark" onClick={() => fileRef.current?.click()}><ImagePlus size={15} />Choose a photo</button><small>JPEG, PNG, WebP · up to 10 MB</small></div>}</div> : null}
              <input ref={fileRef} type="file" className="visually-hidden" tabIndex={-1} accept="image/jpeg,image/png,image/webp" aria-label="Choose a device photo" onChange={(event) => uploadPhoto(event.target.files?.[0])} />

              <div className={`share-view-bar ${guideStale ? "view-has-changed" : ""}`}><div><ScanLine size={17} /><span>{hasRetainedReview ? <><strong>Your last shared view is saved.</strong><small>Start a new session to share another view.</small></> : guideStale ? <><strong>Your view has changed.</strong><small>Share it again so the assistant can check.</small></> : snapshot ? <><strong>{source === "camera" ? "Guidance uses your last shared frame." : "The assistant has your last shared view."}</strong><small>{source === "camera" ? "Share again after moving the camera or device." : "Make a change, then share a fresh view."}</small></> : <><strong>Your view is ready for a closer look.</strong><small>Start a session to share the first image.</small></>}</span></div><button className="button share-button" disabled={!active || !sourceReady || captureBusy || session.status === "thinking"} onClick={shareCurrentView}>{captureBusy ? <LoaderCircle size={14} className="spin" /> : <ScanLine size={14} />}Share current view</button></div>
              <div className="workflow-rail"><span className={matchingGuide ? "rail-done" : "rail-current"}><span>01</span>Observe{matchingGuide ? <Check size={11} /> : null}</span><i /><span className={matchingGuide && matchingGuide.status !== "verified" ? "rail-current" : ""}><span>02</span>Take a step</span><i /><span className={matchingGuide?.status === "verified" && !guideStale ? "rail-done" : ""}><span>03</span>Verify{matchingGuide?.status === "verified" && !guideStale ? <Check size={11} /> : null}</span></div>
            </section>

            <aside className="assistant-panel" aria-labelledby="assistant-title"><div className="assistant-heading"><span className="assistant-icon"><Focus size={20} strokeWidth={1.4} /></span><div><h2 id="assistant-title">Your visual assistant</h2><p><span className={`assistant-status-dot status-${session.status}`} />{statusLabels[session.status]}</p></div>{active ? <span className="assistant-timer">{timer}</span> : <span className="ai-pill">AI</span>}</div>

              {displayError ? <div className="error-card" role="alert"><CircleAlert size={16} /><p>{displayError}</p><button aria-label="Dismiss error" onClick={() => { setLocalError(null); session.clearError(); }}><X size={13} /></button></div> : null}

              {connecting ? <div className="connecting-state"><div className="voice-orb"><LoaderCircle size={31} strokeWidth={1.3} className="spin" /></div><h3>Opening the conversation.</h3><p>Your selected view is being prepared for the assistant.</p><button className="text-button" onClick={session.end}>Cancel connection</button></div> : null}
              {active || hasRetainedReview ? <>
                {active ? <div className={`active-voice ${session.status === "speaking" ? "voice-speaking" : ""}`}><div className="voice-bars" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => <span key={index} style={{ animationDelay: `${index * 0.12}s` }} />)}</div><span>{session.status === "speaking" ? "Your assistant is speaking" : session.status === "thinking" ? "Inspecting the shared view" : withMicrophone ? "Go ahead, I’m listening" : "Type a question below"}</span><button onClick={session.end} className="end-session" aria-label="End assistance session"><Square size={12} />End</button></div> : <div className="completed-session-note" role="status"><CirclePause size={17} /><div><strong>{session.status === "ended" ? "Session complete" : "Session interrupted"}</strong><p>Your last shared view and conversation are available to review.</p></div></div>}
                {active && session.audioBlocked ? <button className="play-voice-button" onClick={session.resumeAudio}><Volume2 size={15} />Play assistant voice<ArrowRight size={13} /></button> : null}{active && session.viewRequested ? <div className="requested-view-note"><ScanLine size={16} /><div><strong>The assistant needs a fresh view.</strong><p>Show the relevant area, then share your current view.</p><button onClick={shareCurrentView} disabled={!sourceReady || captureBusy}>Share current view <ArrowRight size={12} /></button></div></div> : null}{matchingGuide ? <div className={`guide-card ${guideStale ? "stale-guide" : ""}`}><div className="guide-card-label"><Eye size={14} /><span>{active ? "OBSERVATION" : "LAST OBSERVATION"}</span>{guideStale ? <span className="stale-tag">PREVIOUS VIEW</span> : null}</div><p className="observation-text">{matchingGuide.observation}</p><div className="next-step"><span className="next-step-icon">{matchingGuide.status === "verified" ? <CheckCheck size={18} /> : <ArrowRight size={18} />}</span><div><span className="section-micro-label">{matchingGuide.status === "verified" ? "VERIFIED IN THIS IMAGE" : "NEXT STEP"}</span><p>{matchingGuide.nextStep}</p></div></div></div> : <div className="waiting-guide"><span><ScanLine size={22} strokeWidth={1.5} /></span><p>{!active ? "No structured guide was saved. You can review the conversation below." : session.status === "thinking" ? "Looking closely at the image you shared." : "The assistant’s observations will appear here."}</p></div>}
                {snapshot ? <div className="evidence-card"><div className="evidence-heading"><span><Focus size={13} />{active ? "SHARED FRAME" : "LAST SHARED VIEW"}</span><button onClick={() => evidenceDialog.current?.showModal()}><Maximize2 size={12} />Inspect</button></div><EvidenceFrame snapshot={snapshot} regions={displayRegions} /><p className="frame-caption">{displayRegions.length ? highlightDescription : "The view shared with the assistant."}{guideStale ? " Your current view has changed." : ""}</p></div> : null}
                {matchingGuide ? <GuideChecks guide={matchingGuide} readOnly={!active} /> : null}
                <div className="conversation-area"><button className="transcript-toggle" aria-expanded={transcriptOpen} onClick={() => setTranscriptOpen((open) => !open)}><MessageSquare size={13} />Conversation<span>{session.transcript.length}</span><ChevronDown size={13} className={transcriptOpen ? "rotated" : ""} /></button>{transcriptOpen ? <div className="transcript" aria-label="Conversation transcript">{session.transcript.length ? session.transcript.map((line) => <div className={`transcript-line transcript-${line.role}`} key={line.id}><span>{line.role === "user" ? "You" : "FieldLens"}</span><p>{line.text}</p></div>) : <p className="empty-transcript">Your conversation will appear here.</p>}<div ref={transcriptEnd} /></div> : latestAssistant && !matchingGuide ? <p className="latest-answer">{latestAssistant.text}</p> : null}<form className="message-form" onSubmit={sendMessage}><label htmlFor="assistant-message" className="visually-hidden">Message the assistant</label><input id="assistant-message" placeholder={active ? "Ask about what you see…" : "Start a new session to chat"} disabled={!active} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} autoComplete="off" /><button type="submit" disabled={!active || !message.trim() || session.status === "thinking"} aria-label="Send message"><Send size={15} /></button></form><p className="active-privacy">{active && withMicrophone ? <Mic size={11} /> : <MicOff size={11} />}{!active ? "Microphone off. This review is read-only." : withMicrophone ? "Microphone on until you end the session" : "Text mode. Your microphone is off."}</p></div>
              </> : null}
              {!hasSession ? <div className={`session-start ${hasRetainedReview ? "session-restart" : ""}`}><div className="voice-orb" aria-hidden="true"><Focus size={34} strokeWidth={1} /><span /><span /></div><h3>{session.status === "ended" ? "A fresh pair of eyes?" : "Let’s look at it together."}</h3><p>{hasRetainedReview ? "Start another conversation when you are ready. A new session replaces this review." : "Share what you see. Ask what to do next. The assistant will explain what it notices, one step at a time."}</p><div className="mode-selector" role="group" aria-label="Choose conversation mode"><button aria-pressed={!withMicrophone} className={!withMicrophone ? "selected" : ""} onClick={() => { setWithMicrophone(false); setConsent(false); }}><MessageSquare size={14} />Type & listen</button><button aria-pressed={withMicrophone} className={withMicrophone ? "selected" : ""} onClick={() => { setWithMicrophone(true); setConsent(false); }}><Mic size={14} />Talk & listen</button></div><p className="mode-explanation">{withMicrophone ? "Your microphone stays on during the session." : "Type your questions. No microphone access needed."}</p><label className="consent-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to send selected images{withMicrophone ? ", microphone audio," : ""} and messages to OpenAI for this session.</span></label><button className="button button-gold start-button" onClick={startSession} disabled={!readyToStart}>{captureBusy ? <LoaderCircle size={16} className="spin" /> : withMicrophone ? <Mic size={16} /> : <AudioLines size={16} />}{session.status === "ended" || hasRetainedReview ? "Start a new session" : "Start visual assistance"}<ArrowRight size={16} /></button><p className="session-disclosure"><Volume2 size={12} />AI-generated voice · {session.config ? `${Math.round(session.config.maxSessionSeconds / 60)}-minute session` : "Short guided session"}</p>{session.config && !session.config.liveEnabled ? <div className="availability-note"><Info size={14} /><span>Live assistance is currently unavailable. You can still explore the interactive device.</span></div> : !session.config ? <p className="config-loading"><LoaderCircle size={11} className="spin" />Checking live availability…</p> : null}</div> : null}
              <div className="assistant-panel-footer"><LockKeyhole size={12} /><span>Share only what you want the assistant to see.</span></div>
            </aside>
          </div>
        </section>

        <div className="bench-disclaimer"><Info size={14} /><p>Fictional device and visual checks. No real printer is controlled.</p><span>BUILT WITH AI · GUIDED BY PEOPLE</span></div>
        <section className="how-section" id="how-it-works" aria-labelledby="how-title"><div className="how-intro"><p className="eyebrow">LESS GUESSING. MORE CONTEXT.</p><h2 id="how-title">Support starts<br />with seeing.</h2><p>Explore a small example of how shared context can change a support conversation.</p></div><div className="how-steps"><article><span>01 / SHOW</span><h3>Share the actual view</h3><p>A rendered demo, a camera frame, or a photo. The assistant receives the image you choose to share.</p></article><article><span>02 / DISCUSS</span><h3>Get a next step</h3><p>Talk or type. Ask about a visible detail and hear a short explanation, with the evidence in view.</p></article><article><span>03 / CHECK</span><h3>See what changed</h3><p>Take the action yourself. Share a new image so the assistant can check the result instead of assuming it worked.</p></article></div></section>
        <section className="contact-section"><div><p className="eyebrow">FROM A SMALL DEMO TO YOUR WORKFLOW</p><h2>What could your team<br />solve with a better view?</h2></div><div><p>We build practical AI tools around real business processes. Bring us a support bottleneck, a manual check, or a workflow worth improving.</p><a href={CONTACT_URL} target="_blank" rel="noreferrer" className="button button-dark">Talk to Webytex <ArrowUpRight size={17} /></a></div></section>
      </main>
      <footer className="site-footer page-width"><div>WEBYTEX<span>Small tools. Useful possibilities.</span></div><p>Original fictional device. AI-generated assistance. Human judgment required.<br />{repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noreferrer">Explore the source <ArrowUpRight size={11} /></a> : "Source publication is being prepared."}</p></footer>
      <dialog ref={evidenceDialog} className="evidence-dialog"><div className="evidence-dialog-heading"><span><Focus size={15} />Shared frame</span><button onClick={() => evidenceDialog.current?.close()} autoFocus aria-label="Close shared frame"><X size={19} /></button></div>{snapshot ? <EvidenceFrame snapshot={snapshot} regions={displayRegions} expanded /> : null}<p>{displayRegions.length ? `${highlightDescription} ${displayRegions.map((region, index) => `${index + 1}. ${region.label}`).join(" · ")}` : "This is the view shared with the assistant."}</p></dialog>
      <span className="visually-hidden" role="status" aria-live="polite">{announcement}</span>
    </>
  );
}
