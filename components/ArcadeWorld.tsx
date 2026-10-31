"use client";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArcadeIcon } from "./ArcadeIcon";

export type WorldKind = "portal" | "trophy" | "chest" | "podium" | "quiz";
const Scene = dynamic(() => import("./three/ArcadeScene"), { ssr: false });
class SceneBoundary extends Component<{ children: ReactNode; onFailure(): void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
const descriptions: Record<WorldKind, string> = {
  portal: "Arcadia’s dimensional Gateway A portal on a floating lavender island, surrounded by clouds and collectible stars.",
  trophy: "A golden trophy in Arcadia’s floating tournament arena.",
  chest: "An open arcade chest with golden XP tokens floating above it.",
  podium: "Three friendly arcade characters on a floating winners’ podium.",
  quiz: "A question card and mint answer tile on a small floating island.",
};
export function ArcadeWorld({ kind, className = "", staticOnly = false }: { kind: WorldKind; className?: string; staticOnly?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [eligible, setEligible] = useState(false);
  const [inView, setInView] = useState(false);
  const [visited, setVisited] = useState(false);
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(true);
  const onReady = useCallback(() => setLoaded(true), []);
  const onFailure = useCallback(() => setFailed(true), []);
  useEffect(() => {
    if (staticOnly) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const update = () => setEligible(!media.matches && !connection?.saveData && !["slow-2g", "2g"].includes(connection?.effectiveType ?? ""));
    const observer = new IntersectionObserver(([entry]) => { setInView(entry.isIntersecting); if (entry.isIntersecting) setVisited(true); }, { threshold: .15 });
    if (root.current) observer.observe(root.current);
    const visibility = () => setVisible(!document.hidden);
    // Let the static scene and primary controls arrive before requesting WebGL.
    const timer = window.setTimeout(update, 900);
    media.addEventListener("change", update); document.addEventListener("visibilitychange", visibility);
    return () => { clearTimeout(timer); observer.disconnect(); media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); };
  }, [staticOnly]);
  useEffect(() => {
    if (!loaded || !playing || !inView || !visible) return;
    const timer = window.setTimeout(() => setPlaying(false), 12_000);
    return () => clearTimeout(timer);
  }, [loaded, playing, inView, visible]);
  const mount = eligible && visited && !failed;
  useEffect(() => { if (!mount) setLoaded(false); }, [mount]);
  return <div ref={root} className={`arcade-world world-${kind} ${className}`} data-scene-state={mount && loaded ? playing ? "playing" : "idle" : "static"}>
    <img className={`world-fallback${mount && loaded ? " is-rendered" : ""}`} src={`/world/${kind}.webp`} alt={descriptions[kind]} width="1000" height="860" loading={kind === "portal" ? "eager" : "lazy"} />
    {mount ? <div className="world-canvas" aria-hidden="true"><SceneBoundary onFailure={onFailure}><Scene kind={kind} playing={playing && inView && visible} onReady={onReady} onFailure={onFailure} /></SceneBoundary></div> : null}
    {mount && loaded ? <button type="button" className="scene-control" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause scene animation" : "Replay scene animation"}><ArcadeIcon name={playing ? "pause" : "play"} size={14} /><span>{playing ? "Pause scene" : "Replay scene"}</span></button> : null}
  </div>;
}
