"use client";

import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { Component, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { Box, Cable, FilePlus2, Maximize2, Printer, RotateCcw, RotateCw } from "lucide-react";
import { CanvasTexture, CatmullRomCurve3, DoubleSide, SRGBColorSpace, TubeGeometry, Vector3, type EulerTuple, type WebGLRenderer, type Scene, type Camera } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { canPrint, INITIAL_DEVICE, updateDevice, type DemoDeviceState, type DemoDeviceAction } from "@/lib/demo-device";
import type { ViewSnapshot } from "@/lib/contracts";

export type DemoBenchHandle = { capture: () => Promise<ViewSnapshot> };
type BenchProps = { onViewChange: (revision: string) => void; onReady?: (ready: boolean) => void };
type RendererState = { gl: WebGLRenderer; scene: Scene; camera: Camera };

function RoundedPart({ size, position, color, radius = 0.07, rotation, metalness = 0 }: { size: [number, number, number]; position: [number, number, number]; color: string; radius?: number; rotation?: EulerTuple; metalness?: number }) {
  const geometry = useMemo(() => new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map((value) => value / 3))), [size[0], size[1], size[2], radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow><meshStandardMaterial color={color} roughness={metalness ? 0.35 : 0.67} metalness={metalness} /></mesh>;
}

function makeLabel(text: string, foreground = "#667075", background = "#ecece4", subline?: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = subline ? 220 : 110;
  const context = canvas.getContext("2d")!;
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = foreground;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "600 55px Arial";
  context.fillText(text, 256, subline ? 78 : 55);
  if (subline) { context.font = "22px Arial"; context.fillText(subline, 256, 149); }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function Label({ text, position, width, height, rotation = [0, 0, 0], background, foreground, subline }: { text: string; position: [number, number, number]; width: number; height: number; rotation?: EulerTuple; background?: string; foreground?: string; subline?: string }) {
  const texture = useMemo(() => makeLabel(text, foreground, background, subline), [text, foreground, background, subline]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} rotation={rotation}><planeGeometry args={[width, height]} /><meshBasicMaterial map={texture} side={DoubleSide} /></mesh>;
}

function USBLead({ connected }: { connected: boolean }) {
  const plugX = connected ? 1.61 : 2.36;
  const plugY = connected ? 0.72 : 0.17;
  const plugZ = connected ? -0.13 : 0.44;
  const geometry = useMemo(() => new TubeGeometry(new CatmullRomCurve3([
    new Vector3(plugX + 0.17, plugY, plugZ),
    new Vector3(2.68, 0.18, 0.04),
    new Vector3(3.03, 0.08, -0.64),
    new Vector3(2.34, 0.08, -1.14),
    new Vector3(1.65, 0.08, -1.29),
  ]), 48, 0.032, 7, false), [plugX, plugY, plugZ]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group><mesh geometry={geometry} castShadow><meshStandardMaterial color="#3e4852" roughness={0.7} /></mesh><RoundedPart size={[0.3, 0.14, 0.2]} position={[plugX, plugY, plugZ]} color="#424d59" radius={0.035} /><RoundedPart size={[0.16, 0.09, 0.13]} position={[plugX - 0.21, plugY, plugZ]} color="#b8bec0" radius={0.01} metalness={0.55} /></group>;
}

function PrinterModel({ device }: { device: DemoDeviceState }) {
  return (
    <group position={[-0.26, 0.04, 0]}>
      <RoundedPart size={[2.98, 0.34, 2.24]} position={[0, 0.31, 0]} color="#5c6364" radius={0.12} />
      <RoundedPart size={[3.05, 1.12, 2.17]} position={[0, 0.96, 0]} color="#dddeda" radius={0.13} />
      <RoundedPart size={[2.78, 0.08, 1.96]} position={[0, 1.54, 0]} color="#606669" radius={0.03} />
      <RoundedPart size={[2.4, 0.13, 1.67]} position={[0, 1.58, 0]} color="#2d353a" radius={0.04} />
      <RoundedPart size={[1.96, 0.16, 0.8]} position={[0, 1.54, 0.05]} color="#424b4e" radius={0.05} />
      {[-0.65, 0, 0.65].map((x) => <mesh key={x} position={[x, 1.56, 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.07, 0.07, 0.32, 20]} /><meshStandardMaterial color="#252d31" roughness={0.88} /></mesh>)}

      <group position={[0, 1.61, -0.94]} rotation={[device.coverClosed ? 0 : -0.63, 0, 0]}>
        <RoundedPart size={[3.06, 0.18, 2.13]} position={[0, 0.12, 0.95]} color="#f0efe6" radius={0.11} />
        <RoundedPart size={[2.02, 0.025, 1.42]} position={[0, 0.222, 0.99]} color="#d0d5cc" radius={0.01} />
        <RoundedPart size={[1.73, 0.017, 1.17]} position={[0, 0.239, 0.99]} color="#b9c4bc" radius={0.004} />
        <RoundedPart size={[0.64, 0.085, 0.09]} position={[0, 0.105, 2.025]} color="#c2c7c2" radius={0.03} />
      </group>

      <RoundedPart size={[2.87, 0.53, 0.1]} position={[0, 1.225, 1.102]} color="#e8e8df" radius={0.02} />
      <Label text="FL-01" subline="DESK PRINTER" position={[-0.8, 1.26, 1.158]} width={0.79} height={0.32} background="#e8e8df" foreground="#444f54" />
      <RoundedPart size={[0.74, 0.265, 0.027]} position={[0.82, 1.25, 1.167]} color="#434b4d" radius={0.04} />
      <Label text="FIELDLENS" position={[0.8, 1.25, 1.183]} width={0.52} height={0.1} background="#434b4d" foreground="#c4d1b1" />
      <mesh position={[1.27, 1.26, 1.174]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.03, 16]} /><meshStandardMaterial color="#90bb7d" emissive="#719565" emissiveIntensity={0.35} /></mesh>
      <RoundedPart size={[2.47, 0.19, 0.13]} position={[0, 0.854, 1.105]} color="#323b3d" radius={0.025} />
      <RoundedPart size={[2.6, 0.3, 0.12]} position={[0, 0.595, 1.12]} color="#d1d4cd" radius={0.015} />
      <RoundedPart size={[2.45, 0.09, 1.04]} position={[0, 0.431, 1.62]} color="#5e686b" radius={0.035} />
      <RoundedPart size={[2.48, 0.25, 0.1]} position={[0, 0.55, 2.105]} color="#a8b1af" radius={0.03} />
      <Label text="PAPER" position={[0, 0.55, 2.159]} width={0.68} height={0.14} background="#a8b1af" foreground="#394a4b" />
      <RoundedPart size={[0.09, 0.16, 0.82]} position={[-1.17, 0.52, 1.64]} color="#c0c9c3" radius={0.02} />
      <RoundedPart size={[0.09, 0.16, 0.82]} position={[1.17, 0.52, 1.64]} color="#c0c9c3" radius={0.02} />
      {device.paperLoaded ? <group>{[0, 1, 2, 3].map((index) => <RoundedPart key={index} size={[1.87, 0.017, 1.14]} position={[0, 0.49 + index * 0.02, 1.44]} color={index % 2 ? "#ffffff" : "#e3e8e1"} radius={0.006} />)}</group> : <Label text="EMPTY" position={[0, 0.486, 1.54]} rotation={[-Math.PI / 2, 0, 0]} width={0.72} height={0.22} background="#5e686b" foreground="#d3d8d0" />}
      <RoundedPart size={[0.035, 0.24, 0.27]} position={[1.538, 0.72, -0.13]} color="#889590" radius={0.01} />
      <RoundedPart size={[0.042, 0.155, 0.19]} position={[1.561, 0.72, -0.13]} color="#202a2e" radius={0.008} />
      <Label text="USB" position={[1.542, 0.95, -0.13]} rotation={[0, Math.PI / 2, 0]} width={0.36} height={0.115} background="#dddeda" foreground="#5b6b6a" />
      {[0, 1, 2, 3, 4].map((index) => <RoundedPart key={index} size={[0.023, 0.027, 0.49]} position={[1.538, 1.22 - index * 0.055, 0.47]} color="#a4aeaa" radius={0.005} />)}
      <USBLead connected={device.usbConnected} />
      {device.printed ? <group position={[0, 0.89, 1.71]} rotation={[-Math.PI / 2 + 0.13, 0, 0]}><mesh receiveShadow castShadow><planeGeometry args={[1.72, 1.4]} /><meshStandardMaterial color="#fffefa" side={DoubleSide} /></mesh><Label text="TEST PAGE" subline="FL-01 · PRINT COMPLETE" position={[0, 0.05, 0.008]} width={1.46} height={0.62} background="#fffefa" foreground="#3c6559" />{[0, 1, 2].map((index) => <mesh key={index} position={[0, -0.38 - index * 0.07, 0.014]}><planeGeometry args={[1.12 - index * 0.16, 0.022]} /><meshBasicMaterial color="#b2cbb8" /></mesh>)}</group> : null}
      <RoundedPart size={[1.6, 0.07, 1.08]} position={[-2.46, 0.09, 0.12]} color="#f7f8ef" radius={0.01} rotation={[0, -0.13, 0]} />
      <RoundedPart size={[1.6, 0.025, 1.08]} position={[-2.46, 0.142, 0.12]} color="#ffffff" radius={0.004} rotation={[0, -0.1, 0]} />
      <Label text="A4" position={[-2.46, 0.16, 0.12]} rotation={[-Math.PI / 2, 0, -0.1]} width={0.42} height={0.16} background="#ffffff" foreground="#9eaaa5" />
    </group>
  );
}

function SceneControls({ view, onChanged }: { view: number; onChanged: () => void }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 0.78, 0.2);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 6.6;
    controls.maxDistance = 12;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = 1.42;
    controls.enableDamping = false;
    controls.addEventListener("end", onEnd);
    controls.update();
    controlsRef.current = controls;
    function onEnd() { changedRef.current(); }
    return () => { controls.removeEventListener("end", onEnd); controls.dispose(); controlsRef.current = null; };
  }, [camera, gl]);
  useEffect(() => {
    const positions: [number, number, number][] = [[5.27, 4.03, 6.58], [0.17, 4.88, 7.51], [6.63, 3.35, 3.26]];
    camera.position.set(...positions[view % positions.length]);
    controlsRef.current?.update();
  }, [camera, view]);
  useFrame(() => controlsRef.current?.update());
  return null;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="bench-fallback"><Box size={32} /><h3>The 3D bench is unavailable.</h3><p>Try a recent browser with graphics enabled, or share a photo instead.</p></div> : this.props.children; }
}

export const DemoBench = forwardRef<DemoBenchHandle, BenchProps>(function DemoBench({ onViewChange, onReady }, ref) {
  const [device, setDevice] = useState<DemoDeviceState>({ ...INITIAL_DEVICE });
  const [view, setView] = useState(0);
  const [ready, setReady] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const rendererRef = useRef<RendererState | null>(null);
  const revisionRef = useRef("demo-initial");
  const viewChangeRef = useRef(onViewChange);
  viewChangeRef.current = onViewChange;
  const markChanged = useCallback(() => {
    revisionRef.current = `demo-${crypto.randomUUID()}`;
    viewChangeRef.current(revisionRef.current);
  }, []);

  useEffect(() => { onReady?.(ready); return () => onReady?.(false); }, [ready, onReady]);
  useImperativeHandle(ref, () => ({
    async capture() {
      const renderer = rendererRef.current;
      if (!renderer || !ready) throw new Error("The demo view is still loading. Please try again in a moment.");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      renderer.gl.render(renderer.scene, renderer.camera);
      const source = renderer.gl.domElement;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1024 / source.width);
      canvas.width = Math.round(source.width * scale);
      canvas.height = Math.round(source.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not capture this view.");
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      let quality = 0.86;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length * 0.75 > 256_000 && quality > 0.32) { quality -= 0.1; dataUrl = canvas.toDataURL("image/jpeg", quality); }
      if (dataUrl.length * 0.75 > 256_000) throw new Error("This frame is too large to share. Zoom out and try again.");
      return { dataUrl, width: canvas.width, height: canvas.height, capturedAt: Date.now(), revision: revisionRef.current, source: "demo" };
    },
  }), [ready]);

  function act(action: DemoDeviceAction) {
    setDevice((current) => updateDevice(current, action));
    markChanged();
    const messages: Record<DemoDeviceAction, string> = { paper: device.paperLoaded ? "Paper removed." : "Paper loaded.", cover: device.coverClosed ? "Cover opened." : "Cover closed.", usb: device.usbConnected ? "USB disconnected." : "USB connected.", test_print: "Test page printed in the simulation.", reset: "The demo device was reset." };
    setActionMessage(messages[action]);
  }

  return (
    <div className="demo-bench">
      <div className="device-canvas" role="img" aria-label={`Fictional FL-01 printer. Paper ${device.paperLoaded ? "loaded" : "empty"}. Cover ${device.coverClosed ? "closed" : "open"}. USB ${device.usbConnected ? "connected" : "disconnected"}.${device.printed ? " A test page is visible." : ""}`}>
        <SceneBoundary><Canvas shadows="percentage" dpr={[1, 1.5]} gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }} camera={{ position: [5.27, 4.03, 6.58], fov: 37, near: 0.1, far: 60 }} onCreated={(state: RootState) => { rendererRef.current = state; setReady(true); }} fallback={<div className="bench-fallback">WebGL is unavailable. Use a photo to explore visual assistance.</div>}>
          <color attach="background" args={["#e6e4dc"]} /><fog attach="fog" args={["#e6e4dc", 19, 38]} />
          <ambientLight intensity={1.1} /><hemisphereLight args={["#ffffff", "#97937f", 1.8]} />
          <directionalLight position={[-3.5, 7, 5]} intensity={3.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={0.045} shadow-bias={-0.00015} />
          <directionalLight position={[5, 3, -3]} intensity={1.3} color="#d4e4e0" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#e6e4dc" roughness={1} /></mesh>
          <PrinterModel device={device} /><SceneControls view={view} onChanged={markChanged} />
        </Canvas></SceneBoundary>
      </div>
      <div className="view-controls"><span>Drag to inspect <span>·</span> Scroll to zoom</span><div><button onClick={() => { setView((current) => current + 1); markChanged(); }} title="Change camera angle" aria-label="Change camera angle"><RotateCw size={14} /></button><button onClick={() => { setView(0); markChanged(); }} title="Reset camera angle" aria-label="Reset camera angle"><Maximize2 size={14} /></button></div></div>
      <div className="device-actions" aria-label="Interact with the fictional printer"><button onClick={() => act("paper")} aria-pressed={device.paperLoaded}><FilePlus2 size={16} /><span>{device.paperLoaded ? "Remove paper" : "Load paper"}</span></button><button onClick={() => act("cover")} aria-pressed={device.coverClosed}><Box size={16} /><span>{device.coverClosed ? "Open cover" : "Close cover"}</span></button><button onClick={() => act("usb")} aria-pressed={device.usbConnected}><Cable size={16} /><span>{device.usbConnected ? "Disconnect USB" : "Connect USB"}</span></button><button className="print-action" disabled={!canPrint(device) || device.printed} onClick={() => act("test_print")} title={!canPrint(device) ? "Load paper, close the cover, and connect USB to enable the simulation." : "Print a simulated test page"}><Printer size={16} /><span>{device.printed ? "Page printed" : "Test print"}</span></button></div>
      <div className="device-controls-footer"><span><span className="small-square" />Fictional device. Real rendered images.</span><button onClick={() => act("reset")}><RotateCcw size={11} />Reset device</button></div>
      <span className="visually-hidden" role="status">{actionMessage}</span>
    </div>
  );
});
