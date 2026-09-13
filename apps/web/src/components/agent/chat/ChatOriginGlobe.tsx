import { useEffect, useRef } from "react";
import createGlobe from "cobe";
import type { OriginCity } from "@shared/types";
import { cityLabel } from "../../../lib/labels";

const CITIES: Record<OriginCity, { lat: number; lng: number }> = {
  SYD: { lat: -33.87, lng: 151.21 },
  MEL: { lat: -37.81, lng: 144.96 },
  PER: { lat: -31.95, lng: 115.86 },
};

const REF = CITIES.SYD;

function targetAngles(origin: OriginCity) {
  const { lat, lng } = CITIES[origin];
  return {
    phi: 1.82 - ((lng - REF.lng) * Math.PI) / 180,
    theta: -0.6 + ((lat - REF.lat) * Math.PI) / 180 * 0.35,
  };
}

function lerpAngle(a: number, b: number, t: number) {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function ChatOriginGlobe({ origin }: { origin: OriginCity }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const originRef = useRef(origin);
  originRef.current = origin;

  useEffect(() => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas) return;

    let destroyed = false;
    let frame = 0;
    let size = shell.clientWidth || 280;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const start = targetAngles(originRef.current);
    let phi = start.phi;
    let theta = start.theta;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ease = reducedMotion ? 1 : 0.07;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi,
      theta,
      scale: 1.05,
      offset: [0, 8],
      dark: 0.08,
      diffuse: 1.35,
      mapSamples: 12000,
      mapBrightness: 3.8,
      mapBaseBrightness: 0.04,
      baseColor: [0.88, 0.94, 0.96],
      markerColor: [0, 0.408, 0.522],
      glowColor: [0.82, 0.92, 0.96],
      opacity: 1,
      markerElevation: 0.04,
      markers: [{ location: [CITIES[originRef.current].lat, CITIES[originRef.current].lng], size: 0.06 }],
    });

    function resize() {
      size = shell!.clientWidth || 280;
      canvas!.width = size * dpr;
      canvas!.height = size * dpr;
      canvas!.style.width = `${size}px`;
      canvas!.style.height = `${size}px`;
      globe.update({ width: size * dpr, height: size * dpr });
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(shell);

    const tick = () => {
      if (destroyed) return;

      const { lat, lng } = CITIES[originRef.current];
      const target = targetAngles(originRef.current);
      phi = lerpAngle(phi, target.phi, ease);
      theta = lerp(theta, target.theta, ease);

      globe.update({
        phi,
        theta,
        markers: [{ location: [lat, lng], size: 0.06 }],
      });

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      globe.destroy();
    };
  }, []);

  return (
    <div ref={shellRef} className="chat-origin-globe" aria-hidden>
      <canvas ref={canvasRef} />
      <p className="chat-origin-globe-label">{cityLabel(origin)}</p>
    </div>
  );
}
