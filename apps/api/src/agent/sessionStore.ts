import type {
  DiscoveryMode,
  DiscoveryStage,
  OfferQuote,
} from "../../../../shared/types.js";

export interface AgentSession {
  id: string;
  discoveryMode?: DiscoveryMode;
  lastStage?: DiscoveryStage;
  seasonAcknowledged: boolean;
  offer?: OfferQuote;
  /** Stable metadata used to reproduce an existing booking canvas for policy overlays. */
  bookingRequestId?: string;
  bookingGeneratedAt?: string;
  /** Hash of client-owned trip inputs; no trip values are persisted server-side. */
  tripFingerprint?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface AgentSessionStore {
  create(now: Date, idGenerator: () => string, ttlHours?: number): AgentSession;
  get(id: string, now: Date): AgentSession | undefined;
  set(session: AgentSession): void;
  delete(id: string): void;
  get size(): number;
}

/** Bounded in-memory metadata store; trip details remain client-owned. */
export class InMemoryAgentSessionStore implements AgentSessionStore {
  private readonly sessions = new Map<string, AgentSession>();

  constructor(
    private readonly limit = 1000,
    private readonly defaultTtlHours = 24,
  ) {}

  create(now: Date, idGenerator: () => string, ttlHours = this.defaultTtlHours): AgentSession {
    const createdAt = now.toISOString();
    const session: AgentSession = {
      id: idGenerator(),
      seasonAcknowledged: false,
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString(),
    };
    // Creation is transactional: the orchestrator commits with set() only after
    // the turn has produced a successful response.
    return structuredClone(session);
  }

  get(id: string, now: Date): AgentSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (new Date(session.expiresAt).getTime() <= now.getTime()) {
      this.sessions.delete(id);
      return undefined;
    }
    return structuredClone(session);
  }

  set(session: AgentSession): void {
    const now = new Date(session.updatedAt);
    this.evictExpired(now);
    if (!this.sessions.has(session.id)) this.evictAtCapacity();
    this.sessions.set(session.id, structuredClone(session));
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  get size(): number {
    return this.sessions.size;
  }

  private evictExpired(now: Date): void {
    for (const [id, session] of this.sessions) {
      if (new Date(session.expiresAt).getTime() <= now.getTime()) {
        this.sessions.delete(id);
      }
    }
  }

  private evictAtCapacity(): void {
    while (this.sessions.size >= this.limit) {
      const oldest = this.sessions.keys().next().value;
      if (typeof oldest !== "string") break;
      this.sessions.delete(oldest);
    }
  }
}
