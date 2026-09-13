import type { RecoveryNudge } from "@shared/types";

export function buildFallbackNudge(partial: {
  itineraryLine: string;
  whyGateway: string[];
  loyaltyLine?: string;
}): RecoveryNudge {
  return {
    headline: "Still deciding? Keep your Veya trip sketch — book direct on VNA.",
    itineraryLine: partial.itineraryLine,
    whyGateway: partial.whyGateway,
    loyaltyLine: partial.loyaltyLine,
    directValueLines: [
      "Book on vietnamairlines.com: miles + member offers OTAs cannot show.",
      "No OTA service fee layer — you stay in the airline relationship.",
    ],
    disclaimer:
      "Illustrative prototype — no real email, fare hold, or live inventory. Confirm everything on vietnamairlines.com.",
    primaryCta: "Continue on Vietnam Airlines",
    secondaryCta: "Save & remind me (mock)",
  };
}
