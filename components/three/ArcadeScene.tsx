"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Group, OrthographicCamera, type Object3D } from "three";
import type { WorldKind } from "../ArcadeWorld";

function Island({ kind, playing, onReady }: { kind: WorldKind; playing: boolean; onReady(): void }) {
  const { scene } = useGLTF(`/models/${kind}.glb`, "/draco/");
  const copy = useMemo(() => scene.clone(true), [scene]);
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  const { invalidate } = useThree();
  const collectibles = useMemo(() => {
    const items: { object: Object3D; y: number; rotation: number }[] = [];
    copy.traverse(object => { if (/Orbit|XP[ _]coin|Collectible|Cloud/.test(object.name)) items.push({ object, y: object.position.y, rotation: object.rotation.y }); });
    return items;
  }, [copy]);
  useEffect(() => { onReady(); invalidate(); }, [copy, invalidate, onReady]);
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(invalidate, 1000 / 30);
    return () => clearInterval(interval);
  }, [playing, invalidate]);
  useFrame((_, delta) => {
    if (!playing || !group.current) return;
    elapsed.current += Math.min(delta, .05);
    const t = elapsed.current;
    group.current.position.y = Math.sin(t * .65) * .075;
    group.current.rotation.y = Math.sin(t * .22) * .055;
    collectibles.forEach(({ object, y, rotation }, i) => { object.position.y = y + Math.sin(t * .85 + i) * .09; if (!object.name.startsWith("Cloud")) object.rotation.y = rotation + Math.sin(t + i) * .18; });
  });
  return <group ref={group}><primitive object={copy} /></group>;
}
function FitCamera({ kind }: { kind: WorldKind }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    const width = kind === "portal" ? 9.7 : 7.6;
    camera.zoom = Math.min(size.width / width, size.height / (width * .86));
    camera.updateProjectionMatrix(); invalidate();
  }, [camera, size, kind, invalidate]);
  return null;
}
function ContextLossMonitor({ onFailure }: { onFailure(): void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", onFailure);
    return () => canvas.removeEventListener("webglcontextlost", onFailure);
  }, [gl, onFailure]);
  return null;
}
export default function ArcadeScene({ kind, playing, onReady, onFailure }: { kind: WorldKind; playing: boolean; onReady(): void; onFailure(): void }) {
  return <Canvas frameloop="demand" dpr={[1, 1.35]} orthographic camera={{ position: [7, 8, 12], zoom: kind === "portal" ? 48 : 58, near: .1, far: 60 }} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} onCreated={({ camera }) => { camera.lookAt(0, 1.05, 0); }} fallback={null}>
    <FitCamera kind={kind} />
    <ContextLossMonitor onFailure={onFailure} />
    <ambientLight intensity={1.4} />
    <hemisphereLight args={["#fffcf4", "#7774bc", 2]} />
    <directionalLight position={[-3, 9, 5]} intensity={3.8} color="#fff2da" />
    <directionalLight position={[5, 5, 2]} intensity={2} color="#b5caff" />
    <directionalLight position={[0, 7, -5]} intensity={2.3} color="#cfb5ff" />
    <Suspense fallback={null}><Island kind={kind} playing={playing} onReady={onReady} /></Suspense>
  </Canvas>;
}
