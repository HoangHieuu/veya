import type { TripIntent } from "../../../../shared/types.js";
import type { ReasonTrace, ScoredRoute, ScoreWeights } from "./engine.js";

export interface AuditCandidate {
  routeId: string;
  weightedTotal: number;
  rank: number;
  factors: ScoredRoute["score"];
  reasonTraces: ReasonTrace[];
}

export interface ScoringAuditSnapshot {
  requestId: string;
  createdAt: string;
  intent: TripIntent;
  weights: ScoreWeights;
  tieBreak: ["routeConvenience", "intentMatch", "routeId"];
  candidateCount: number;
  candidates: AuditCandidate[];
}

export class ScoringAuditStore {
  private readonly snapshots: ScoringAuditSnapshot[] = [];

  constructor(private readonly limit = 20) {}

  add(snapshot: ScoringAuditSnapshot) {
    this.snapshots.unshift(structuredClone(snapshot));
    this.snapshots.splice(this.limit);
  }

  list(): ScoringAuditSnapshot[] {
    return structuredClone(this.snapshots);
  }
}
