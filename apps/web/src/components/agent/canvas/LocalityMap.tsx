import type { LocalityResolution } from "../../../lib/agentTypes";

import { GATEWAY_GEO, isSameHub, resolveLocalityGeo } from "../../../lib/geo/localities";

import { RouteDiagram } from "./RouteDiagram";



function isCaMauRoute(resolution: LocalityResolution): boolean {

  return (

    resolution.gateway === "SGN" &&

    (resolution.localityId === "ca-mau" ||

      /c[aà]\s*mau/i.test(resolution.localityTitle))

  );

}



export function LocalityMap({

  resolution,

  compact,

}: {

  resolution: LocalityResolution;

  compact?: boolean;

}) {

  const gateway = GATEWAY_GEO[resolution.gateway];

  const locality = resolveLocalityGeo(

    resolution.localityId,

    resolution.localityTitle,

    resolution.gateway,

  );

  const useOsrm = isCaMauRoute(resolution);

  const sameHub = isSameHub(gateway, locality);



  return (

    <div className={compact ? "agent-map-compact" : "agent-map-wrap"}>

      <RouteDiagram gateway={gateway} locality={locality} useOsrm={useOsrm} />

      {!sameHub ? (

        <div className="agent-map-legend">

          <span>

            <i className="agent-map-dot agent-map-dot-gw" /> {gateway.label} · fly in

          </span>

          <span>

            <i className="agent-map-dot agent-map-dot-loc" /> {locality.label} · visit

          </span>

        </div>

      ) : null}

    </div>

  );

}

