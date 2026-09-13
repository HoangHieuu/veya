import localityGatewayData from "../../../../data/locality-gateway.json";
import {
  extractMentionedLocalities,
  inferGatewayFromLocalities,
  normalizeLocalityGateway,
  type LocalityGatewayData,
} from "@shared/localityGateway";
import type { DestinationCity, RankedResponse } from "@shared/types";
import type {
  AgentAction,
  AgentCanvasState,
  DiscoveryMode,
  LocalityResolution,
  OfferQuote,
} from "./agentTypes";
import type { MemberDemoProfile } from "./memberDemo";
import { isMember } from "./memberDemo";

const LOCALITY = normalizeLocalityGateway(
  localityGatewayData as Parameters<typeof normalizeLocalityGateway>[0],
) as LocalityGatewayData;

const GATEWAY_LABEL: Record<DestinationCity, string> = {
  HAN: "Hanoi",
  SGN: "Ho Chi Minh City",
  DAD: "Da Nang",
};

const ONWARD: Record<string, string> = {
  "ca-mau":
    "Plan ~3 hours by road from Tan Son Nhat (SGN) to reach Cà Mau — or a domestic connection.",
};

export function classifyDiscoveryMode(briefText: string): DiscoveryMode {
  const t = briefText.trim();
  if (!t) return "discovery";

  if (
    /\b(?:SYD|MEL|PER)\s*(?:→|->|to|-)\s*(?:HAN|SGN|DAD)\b/i.test(t) ||
    /\bbook(?:ing)?\s+(?:a\s+)?(?:flight\s+)?(?:SYD|MEL|PER)\s+to\s+(?:HAN|SGN|DAD|Hanoi|Saigon|Ho Chi Minh|Da Nang)\b/i.test(
      t,
    )
  ) {
    return "route_known";
  }

  if (inferGatewayFromLocalities(t, LOCALITY)) return "discovery";
  if (/\b(?:or|vs|versus|either|not sure|don't know|compare|which city)\b/i.test(t)) {
    return "discovery";
  }
  if (/\b(?:beach|food|family|visit|trip|holiday|vacation)\b/i.test(t) && !/\bto\s+(?:HAN|SGN|DAD)\b/i.test(t)) {
    return "discovery";
  }

  return "route_known";
}

function buildRuledOut(
  gateway: DestinationCity,
  localityTitle?: string,
): LocalityResolution["ruledOut"] {
  const all: DestinationCity[] = ["HAN", "SGN", "DAD"];
  return all
    .filter((g) => g !== gateway)
    .map((g) => ({
      gateway: g,
      reason:
        localityTitle && g === "HAN"
          ? `Too far north for ${localityTitle} — long domestic leg after landing.`
          : localityTitle && g === "DAD"
            ? `Central coast gateway — poor fit for Mekong delta / deep south visits.`
            : `${GATEWAY_LABEL[g]} is not the closest VNA gateway for this trip.`,
    }));
}

function buildLocalityResolution(briefText: string): LocalityResolution | undefined {
  const gateway = inferGatewayFromLocalities(briefText, LOCALITY);
  if (!gateway) return undefined;

  const titles = extractMentionedLocalities(briefText, LOCALITY);
  const title = titles[0] ?? "your destination";
  const id = title.toLowerCase().replace(/\s+/g, "-");

  return {
    localityId: id,
    localityTitle: title,
    gateway,
    ruledOut: buildRuledOut(gateway, title),
    onwardNote: ONWARD[id] ?? `Connect from ${GATEWAY_LABEL[gateway]} after you land.`,
  };
}

function illustrativeBaseMiles(originCity: string, destinationCity: string): number {
  const key = `${originCity}-${destinationCity}`;
  const byRoute: Record<string, number> = {
    "SYD-HAN": 920,
    "SYD-SGN": 780,
    "SYD-DAD": 820,
    "MEL-HAN": 980,
    "MEL-SGN": 840,
    "MEL-DAD": 880,
    "PER-HAN": 1100,
    "PER-SGN": 960,
    "PER-DAD": 900,
  };
  return byRoute[key] ?? 800;
}

function buildOfferQuote(
  response: RankedResponse,
  discoveryMode: DiscoveryMode,
  memberProfile: MemberDemoProfile,
): OfferQuote {
  const card = response.cards[0];
  if (!card || discoveryMode !== "discovery") {
    return {
      eligible: false,
      ineligibleReason: "Bonus miles offer applies when you're still choosing where to fly in.",
      baseMiles: 0,
      bonusMiles: 0,
      totalMiles: 0,
      expiresAt: new Date().toISOString(),
      termsId: "direct-decision-offer",
      illustrative: true,
    };
  }

  const { originCity, destinationCity } = card.route;
  const baseMiles = illustrativeBaseMiles(originCity, destinationCity);
  const bonusMiles = isMember(memberProfile) ? 200 : 150;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    eligible: true,
    baseMiles,
    bonusMiles,
    totalMiles: baseMiles + bonusMiles,
    expiresAt,
    termsId: "direct-decision-offer",
    illustrative: true,
  };
}

function agentAck(
  discoveryMode: DiscoveryMode,
  locality?: LocalityResolution,
): string {
  if (locality) {
    return `Mapped ${locality.localityTitle} → fly into ${GATEWAY_LABEL[locality.gateway]}. See the centre panel for gateway fit and bonus miles.`;
  }
  if (discoveryMode === "discovery") {
    return "You're in discovery mode — I've ranked gateways that fit your trip. Check the centre panel for your limited-time bonus miles.";
  }
  return "Here's your best VNA route. Live fares confirm on Vietnam Airlines at checkout.";
}

/** Client-side canvas builder until D ships API canvas block */
export function buildAgentCanvasState(
  response: RankedResponse,
  briefText: string,
  memberProfile: MemberDemoProfile,
): AgentCanvasState {
  const discoveryMode = classifyDiscoveryMode(briefText);
  const locality = buildLocalityResolution(briefText);
  const offer = buildOfferQuote(response, discoveryMode, memberProfile);

  const actions: AgentAction[] = [
    { type: "showIntent", summary: response.intent.rawSummary, intent: response.intent },
  ];

  if (locality) {
    actions.push({ type: "showLocality", resolution: locality });
  }

  response.cards.forEach((_, i) => {
    actions.push({ type: "showRoute", cardIndex: i });
  });

  if (response.cards[0]) {
    actions.push({ type: "showExperiences", cardIndex: 0 });
    actions.push({ type: "showDirectValue", cardIndex: 0 });
  }

  if (offer.eligible) {
    actions.push({ type: "showOffer", offer });
    if (!isMember(memberProfile)) {
      actions.push({ type: "showEnrollment" });
    }
    actions.push({ type: "showHandoff", cardIndex: 0 });
  } else if (response.cards[0]) {
    actions.push({ type: "showHandoff", cardIndex: 0 });
  }

  return {
    discoveryMode,
    agentMessage: agentAck(discoveryMode, locality),
    actions,
    offer: offer.eligible ? offer : undefined,
    locality,
    response,
  };
}

