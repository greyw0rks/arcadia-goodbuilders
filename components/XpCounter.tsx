"use client";
import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
export function XpCounter({ value }: { value: number }) {
  const span = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !span.current) return;
    const animation = animate(0, value, { duration: .7, ease: [.23, 1, .32, 1], onUpdate: number => { if (span.current) span.current.textContent = String(Math.round(number)); } });
    return () => animation.stop();
  }, [value, reduced]);
  return <><span ref={span} aria-hidden="true">{value}</span><span className="sr-only">{value}</span></>;
}
