import clsx from "clsx";

import { useEffect, useRef, type CSSProperties } from "react";

import createGlobe from "cobe";

import type { OriginCity } from "@shared/types";

import { useGlobeTuningOptional } from "../context/GlobeTuningContext";

import { DEFAULT_GLOBE_TUNING, type GlobeTuning } from "../lib/globeTuning";

import { cityLabel } from "../lib/labels";



const AU_CODES: OriginCity[] = ["SYD", "MEL", "PER"];



const CITIES: Record<OriginCity, { lat: number; lng: number }> = {

  SYD: { lat: -33.87, lng: 151.21 },

  MEL: { lat: -37.81, lng: 144.96 },

  PER: { lat: -31.95, lng: 115.86 },

};



const REF = CITIES.SYD;



const MARKER_ELEVATION = 0.05;

const GLOBE_RADIUS = 0.8;



function latLngToVec3(lat: number, lng: number): [number, number, number] {

  const phi = (lat * Math.PI) / 180;

  const lam = (lng * Math.PI) / 180 - Math.PI;

  const cosPhi = Math.cos(phi);

  return [-cosPhi * Math.cos(lam), Math.sin(phi), cosPhi * Math.sin(lam)];

}



/** Match COBE screen projection for HTML pin placement */

function projectMarker(

  lat: number,

  lng: number,

  phi: number,

  theta: number,

  scale: number,

  offset: [number, number],

  width: number,

  height: number,

) {

  const v = latLngToVec3(lat, lng);

  const r = GLOBE_RADIUS + MARKER_ELEVATION;

  const x = v[0] * r;

  const y = v[1] * r;

  const z = v[2] * r;



  const cosT = Math.cos(theta);

  const sinT = Math.sin(theta);

  const cosP = Math.cos(phi);

  const sinP = Math.sin(phi);



  const cx = cosP * x + sinP * z;

  const cy = sinP * sinT * x + cosT * y - cosP * sinT * z;

  const cz = -sinP * cosT * x + sinT * y + cosP * cosT * z;



  const aspect = width / height;

  const sx = (cx / aspect) * scale + (offset[0] * scale) / width + 1;

  const sy = -cy * scale + (offset[1] * scale) / height + 1;



  const visible = cz >= 0 || cx * cx + cy * cy >= 0.64;



  return {

    x: sx / 2,

    y: sy / 2,

    visible,

  };

}



function targetAngles(origin: OriginCity, tuning: GlobeTuning) {

  const { lat, lng } = CITIES[origin];

  return {

    phi: tuning.auPhi - ((lng - REF.lng) * Math.PI) / 180,

    theta: tuning.auTheta + ((lat - REF.lat) * Math.PI) / 180 * tuning.latFactor,

  };

}



function resolveAngles(origin: OriginCity, tuning: GlobeTuning) {

  if (tuning.manual) {

    return { phi: tuning.manualPhi, theta: tuning.manualTheta };

  }

  const active = tuning.usePreviewOrigin ? tuning.previewOrigin : origin;

  return targetAngles(active, tuning);

}



function lerp(a: number, b: number, t: number) {

  return a + (b - a) * t;

}



function lerpAngle(a: number, b: number, t: number) {

  let diff = b - a;

  while (diff > Math.PI) diff -= 2 * Math.PI;

  while (diff < -Math.PI) diff += 2 * Math.PI;

  return a + diff * t;

}



export function OriginGlobe({

  origin,

  className,

}: {

  origin: OriginCity;

  className?: string;

}) {

  const tuningCtx = useGlobeTuningOptional();

  const tuning = tuningCtx?.tuning ?? DEFAULT_GLOBE_TUNING;

  const tuningRef = useRef(tuning);

  tuningRef.current = tuning;



  const shellRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pinRefs = useRef<Partial<Record<OriginCity, HTMLSpanElement | null>>>({});

  const originRef = useRef(origin);

  originRef.current = origin;



  const displayOrigin =

    tuning.usePreviewOrigin && !tuning.manual ? tuning.previewOrigin : origin;



  useEffect(() => {

    const shell = shellRef.current;

    const canvas = canvasRef.current;

    if (!shell || !canvas) return;



    let destroyed = false;

    let frame = 0;

    let size = shell.clientWidth || 360;

    const dpr = Math.min(window.devicePixelRatio, 2);



    const start = resolveAngles(originRef.current, tuningRef.current);

    let phi = start.phi;

    let theta = start.theta;



    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ease = reducedMotion ? 1 : 0.055;



    const globe = createGlobe(canvas, {

      devicePixelRatio: dpr,

      width: size * dpr,

      height: size * dpr,

      phi,

      theta,

      scale: tuningRef.current.scale,

      offset: [tuningRef.current.offsetX, tuningRef.current.offsetY],

      dark: 0,

      diffuse: 1.2,

      mapSamples: 18000,

      mapBrightness: 4.2,

      mapBaseBrightness: 0.08,

      baseColor: [0.96, 0.97, 0.98],

      markerColor: [0, 0.408, 0.522],

      glowColor: [0.95, 0.97, 0.98],

      opacity: 1,

      markerElevation: MARKER_ELEVATION,

      markers: [],

    });



    function resize() {

      size = shell!.clientWidth || 360;

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



      const tuning = tuningRef.current;

      const target = resolveAngles(originRef.current, tuning);

      const stepEase = tuning.manual ? 1 : ease;



      phi = lerpAngle(phi, target.phi, stepEase);

      theta = lerp(theta, target.theta, stepEase);



      globe.update({

        phi,

        theta,

        scale: tuning.scale,

        offset: [tuning.offsetX, tuning.offsetY],

      });



      const w = size * dpr;

      const h = size * dpr;

      for (const code of AU_CODES) {

        const pin = pinRefs.current[code];

        if (!pin) continue;

        const { lat, lng } = CITIES[code];

        const p = projectMarker(

          lat,

          lng,

          phi,

          theta,

          tuning.scale,

          [tuning.offsetX * dpr, tuning.offsetY * dpr],

          w,

          h,

        );

        pin.style.left = `${p.x * 100}%`;

        pin.style.top = `${p.y * 100}%`;

        pin.style.opacity = p.visible ? "1" : "0";

      }



      frame = requestAnimationFrame(tick);

    };

    frame = requestAnimationFrame(tick);



    return () => {

      destroyed = true;

      cancelAnimationFrame(frame);

      ro.disconnect();

      globe.destroy();

      const wrapper = canvas.parentElement;

      if (wrapper && wrapper !== shell && shell.contains(wrapper)) {

        shell.appendChild(canvas);

        wrapper.remove();

      }

    };

  }, []);



  return (

    <div ref={shellRef} className={clsx("origin-globe-shell", className)} aria-hidden>

      <canvas ref={canvasRef} className="block w-full" />

      {AU_CODES.map((code) => {

        const isActive = code === displayOrigin;

        return (

          <span

            key={code}

            ref={(el) => {

              pinRefs.current[code] = el;

            }}

            data-marker={code.toLowerCase()}

            className={clsx("globe-pin", isActive && "globe-pin-active")}

            style={

              {

                left: "50%",

                top: "50%",

                opacity: 0,

              } as CSSProperties

            }

          >

            <span className="globe-pin-marker">

              <span className="globe-pin-ring" aria-hidden />

              <span className="globe-pin-dot" aria-hidden />

            </span>

            {isActive ? (

              <span className="globe-pin-label">{cityLabel(code)}</span>

            ) : null}

          </span>

        );

      })}

    </div>

  );

}
