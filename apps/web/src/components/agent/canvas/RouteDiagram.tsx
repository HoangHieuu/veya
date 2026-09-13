import { useEffect, useId, useMemo, useState } from "react";

import type { GeoPoint } from "../../../lib/geo/localities";

import { isSameHub } from "../../../lib/geo/localities";

import { fetchOsrmDrivingRoute } from "../../../lib/geo/osrmRoute";



const W = 320;

const H = 112;

const PAD = 28;



function projectPair(

  gateway: GeoPoint,

  locality: GeoPoint,

): { gw: { x: number; y: number }; loc: { x: number; y: number } } {

  let minLat = Math.min(gateway.lat, locality.lat);

  let maxLat = Math.max(gateway.lat, locality.lat);

  let minLng = Math.min(gateway.lng, locality.lng);

  let maxLng = Math.max(gateway.lng, locality.lng);



  if (maxLat - minLat < 0.9) {

    const c = (maxLat + minLat) / 2;

    minLat = c - 0.45;

    maxLat = c + 0.45;

  }

  if (maxLng - minLng < 0.9) {

    const c = (maxLng + minLng) / 2;

    minLng = c - 0.45;

    maxLng = c + 0.45;

  }



  minLat -= 0.12;

  maxLat += 0.12;

  minLng -= 0.12;

  maxLng += 0.12;



  const project = (lat: number, lng: number) => ({

    x: PAD + ((lng - minLng) / (maxLng - minLng)) * (W - PAD * 2),

    y: PAD + ((maxLat - lat) / (maxLat - minLat)) * (H - PAD * 2),

  });



  return { gw: project(gateway.lat, gateway.lng), loc: project(locality.lat, locality.lng) };

}



function arcPath(a: { x: number; y: number }, b: { x: number; y: number }): string {

  const mx = (a.x + b.x) / 2;

  const my = (a.y + b.y) / 2;

  const dx = b.x - a.x;

  const dy = b.y - a.y;

  const cx = mx - dy * 0.16;

  const cy = my + dx * 0.16;

  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;

}



function HubDiagram({ gateway, locality, uid }: { gateway: GeoPoint; locality: GeoPoint; uid: string }) {

  const cx = W / 2;

  const cy = H / 2 + 4;



  return (

    <svg

      viewBox={`0 0 ${W} ${H}`}

      className="route-diagram-svg"

      role="img"

      aria-label={`${locality.label} gateway`}

    >

      <defs>

        <linearGradient id={`${uid}-hub-bg`} x1="0" y1="0" x2="0" y2="1">

          <stop offset="0%" stopColor="#e8f4f8" />

          <stop offset="100%" stopColor="#f4f8f6" />

        </linearGradient>

      </defs>

      <rect width={W} height={H} rx="12" fill={`url(#${uid}-hub-bg)`} />

      <circle cx={cx} cy={cy} r="22" fill="rgb(0 104 133 / 0.1)" />

      <circle cx={cx} cy={cy} r="8" fill="#006885" stroke="#fff" strokeWidth="2.5" />

      <text x={cx} y={cy - 20} textAnchor="middle" className="route-diagram-label route-diagram-label-gw">

        {gateway.label}

      </text>

      <text x={cx} y={cy + 24} textAnchor="middle" className="route-diagram-sublabel">

        {locality.label} · fly in directly

      </text>

    </svg>

  );

}



export function RouteDiagram({

  gateway,

  locality,

  useOsrm = false,

}: {

  gateway: GeoPoint;

  locality: GeoPoint;

  useOsrm?: boolean;

}) {

  const uid = useId().replace(/:/g, "");

  const sameHub = isSameHub(gateway, locality);

  const { gw, loc } = useMemo(() => projectPair(gateway, locality), [gateway, locality]);

  const pathD = arcPath(gw, loc);



  const [meta, setMeta] = useState<{ distanceKm: number; durationHours: number } | null>(null);



  useEffect(() => {

    if (!useOsrm || sameHub) return;

    let cancelled = false;

    void fetchOsrmDrivingRoute(gateway, locality).then((osrm) => {

      if (cancelled || !osrm) return;

      setMeta({ distanceKm: osrm.distanceKm, durationHours: osrm.durationHours });

    });

    return () => {

      cancelled = true;

    };

  }, [gateway, locality, useOsrm, sameHub]);



  if (sameHub) {

    return (

      <div className="route-diagram route-diagram-compact">

        <HubDiagram gateway={gateway} locality={locality} uid={uid} />

      </div>

    );

  }



  return (

    <div className="route-diagram route-diagram-compact">

      <svg

        viewBox={`0 0 ${W} ${H}`}

        className="route-diagram-svg"

        role="img"

        aria-label={`Route from ${gateway.label} to ${locality.label}`}

      >

        <defs>

          <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">

            <stop offset="0%" stopColor="#e8f4f8" />

            <stop offset="100%" stopColor="#eef3ea" />

          </linearGradient>

          <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">

            <stop offset="0%" stopColor="#006885" />

            <stop offset="100%" stopColor="#c9a227" />

          </linearGradient>

        </defs>



        <rect width={W} height={H} rx="12" fill={`url(#${uid}-bg)`} />



        <path

          d={pathD}

          fill="none"

          stroke={`url(#${uid}-line)`}

          strokeWidth="3"

          strokeLinecap="round"

          strokeDasharray="6 4"

          opacity="0.9"

        />



        <g transform={`translate(${gw.x}, ${gw.y})`}>

          <circle r="11" fill="rgb(0 104 133 / 0.12)" />

          <circle r="6" fill="#006885" stroke="#fff" strokeWidth="2" />

        </g>

        <text x={gw.x} y={gw.y - 14} textAnchor="middle" className="route-diagram-label route-diagram-label-gw">

          {gateway.label}

        </text>



        <g transform={`translate(${loc.x}, ${loc.y})`}>

          <circle r="11" fill="rgb(201 162 39 / 0.15)" />

          <circle r="6" fill="#c9a227" stroke="#fff" strokeWidth="2" />

        </g>

        <text x={loc.x} y={loc.y - 14} textAnchor="middle" className="route-diagram-label route-diagram-label-loc">

          {locality.label}

        </text>

      </svg>



      {meta ? (

        <div className="route-diagram-stats">

          <span>~{meta.distanceKm} km</span>

          <span aria-hidden>·</span>

          <span>~{meta.durationHours} h drive</span>

        </div>

      ) : useOsrm ? (

        <div className="route-diagram-stats route-diagram-stats-muted">Calculating…</div>

      ) : null}

    </div>

  );

}

