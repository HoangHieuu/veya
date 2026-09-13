import clsx from "clsx";
import { VeyaLogo } from "../components/VeyaLogo";
import { Button } from "../components/ui/Button";
import {
  getMemberPersona,
  getPersonaTripSeed,
  MEMBER_PROFILE_OPTIONS,
  memberInitials,
  type MemberDemoProfile,
} from "../lib/memberDemo";

const DESTINATIONS = [
  {
    code: "DAD",
    name: "Da Nang",
    tag: "Beach & coast",
    blurb: "My Khe, Hoi An day trips, central coast.",
    image: "/assets/da-nang-beach.jpg",
  },
  {
    code: "SGN",
    name: "Ho Chi Minh City",
    tag: "Food & city life",
    blurb: "Street food, districts, direct from Sydney & Melbourne.",
    image: "/assets/destinations/ho-chi-minh-city.jpg",
  },
  {
    code: "HAN",
    name: "Hanoi",
    tag: "Culture & history",
    blurb: "Old Quarter, cool-season walks, northern Vietnam base.",
    image: "/assets/destinations/hanoi.png",
  },
] as const;

const GATEWAYS = [
  { code: "SYD", city: "Sydney", note: "Fly to all three cities" },
  { code: "MEL", city: "Melbourne", note: "Nonstop to Hanoi & Saigon" },
  { code: "PER", city: "Perth", note: "Shorter flights westbound" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Pick a traveller",
    body: "Guest, Lotusmiles Gold member, or LotuStudents — each opens with a real trip brief.",
  },
  {
    n: "02",
    title: "Discover your gateway",
    body: "Chat + canvas suggest where to fly in — beach, family visit, or street-food city break.",
  },
  {
    n: "03",
    title: "Continue to book",
    body: "Member offers and miles on the direct channel, then hand off to vietnamairlines.com.",
  },
] as const;

const FAQ = [
  {
    q: "Do I book here?",
    a: "No — we help you choose where to fly in and what fits your trip. Prices and payment happen on Vietnam Airlines when you continue from the last step.",
  },
  {
    q: "Do I need to pick Hanoi vs Saigon first?",
    a: "Not necessarily. Tell us the vibe and dates; we suggest which city to fly into and why.",
  },
  {
    q: "Why not use an OTA?",
    a: "Comparison sites win the click before you pick the right gateway — and they cannot show member-only miles, bundles, or airline support. Veya helps you decide, then hands off to vietnamairlines.com with your trip context.",
  },
  {
    q: "Who are the demo profiles?",
    a: "Guest starts blank with the origin globe. Minh Nguyen (Gold · VFR to Cà Mau) and Alex Tran (LotuStudents · food & culture) load a seeded brief for one-click demos.",
  },
];

const agentCanvasEnabled = import.meta.env.VITE_AGENT_CANVAS === "true";

function originLabel(origin: string): string {
  return origin === "MEL" ? "Melbourne" : origin === "PER" ? "Perth" : "Sydney";
}

export function HomeScreen({
  onStart,
  onTalkToVeya,
  onPlanAsProfile,
}: {
  onStart: () => void;
  onTalkToVeya?: () => void;
  onPlanAsProfile?: (profile: MemberDemoProfile) => void;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <section className="hero-home">
        <a href="/" className="home-brand" onClick={(e) => e.preventDefault()}>
          <VeyaLogo size="md" />
        </a>

        <div className="hero-home-bg pointer-events-none" aria-hidden />

        <div className="hero-home-inner">
          <div className="hero-home-copy anim-rise">
            <p className="hero-home-eyebrow">Vietnam Airlines · Direct channel</p>
            <h1 className="hero-home-title">Win the click before the OTA does</h1>
            <p className="hero-home-lead">
              Not sure Hanoi, Ho Chi Minh City, or Da Nang? Veya is discovery on vietnamairlines.com —
              we suggest the right gateway for your trip, surface member value, then hand off to book direct.
            </p>
            <div className="hero-home-actions">
              {agentCanvasEnabled && onTalkToVeya ? (
                <Button className="min-h-12 px-8 text-base" onClick={onTalkToVeya}>
                  Talk to Veya
                </Button>
              ) : (
                <Button className="min-h-12 px-8 text-base" onClick={onStart}>
                  Start planning →
                </Button>
              )}
              {onPlanAsProfile ? (
                <button
                  type="button"
                  onClick={() => onPlanAsProfile("lotusmiles_member")}
                  className="text-sm font-semibold text-teal transition hover:text-teal/80"
                >
                  Try as Minh Nguyen →
                </button>
              ) : null}
            </div>
          </div>

          <div className="hero-home-plane-wrap anim-rise">
            <img
              src="/vnaplane.png"
              alt=""
              className="hero-home-plane"
              width={900}
              height={500}
              decoding="async"
            />
          </div>
        </div>
      </section>

      <section className="home-gateways">
        <div className="home-section-inner home-gateways-grid">
          {GATEWAYS.map((g) => (
            <div key={g.code} className="home-gateway">
              <span className="home-gateway-code">{g.code}</span>
              <span className="home-gateway-city">{g.city}</span>
              <span className="home-gateway-note">{g.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-inner">
          <p className="home-eyebrow">How Veya works</p>
          <h2 className="home-heading">Three steps to your route</h2>
          <div className="home-steps">
            {STEPS.map((s) => (
              <article key={s.n} className="home-step">
                <span className="home-step-n">{s.n}</span>
                <h3 className="home-step-title">{s.title}</h3>
                <p className="home-step-body">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-ota-loss">
        <div className="home-section-inner">
          <p className="home-eyebrow">The moment we lose you</p>
          <h2 className="home-heading">Why travellers leave for an OTA</h2>
          <ul className="home-ota-list">
            <li>They don&apos;t know which city to fly into — Hanoi, Saigon, and Da Nang are different trips.</li>
            <li>Aggregators feel easier before destination is decided, even when the airline has the better relationship.</li>
            <li>Member miles, bundles, and direct-only offers never show up on a comparison site.</li>
            <li>Veya intercepts that pre-search moment and keeps the booking path on Vietnam Airlines.</li>
          </ul>
        </div>
      </section>

      <section className="home-section home-section-muted">
        <div className="home-section-inner">
          <p className="home-eyebrow">Destinations</p>
          <h2 className="home-heading">Three places you might fly into</h2>
          <div className="home-dest-bento">
            {DESTINATIONS.map((d, i) => (
              <article
                key={d.code}
                className={i === 0 ? "home-dest-card home-dest-card-featured" : "home-dest-card"}
              >
                <img src={d.image} alt="" className="home-dest-img" />
                <div className="home-dest-overlay" />
                <div className="home-dest-content">
                  <span className="home-dest-tag">{d.tag}</span>
                  <p className="home-dest-name">
                    <span className="home-dest-code">{d.code}</span>
                    {d.name}
                  </p>
                  <p className="home-dest-blurb">{d.blurb}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section" id="demo-profiles">
        <div className="home-section-inner">
          <p className="home-eyebrow">Demo travellers</p>
          <h2 className="home-heading">Who are we planning for?</h2>
          <p className="home-personas-lead">
            Guest starts fresh with the globe. Member profiles load a demo brief in one click.
          </p>

          <div className="home-demo-profiles">
            {MEMBER_PROFILE_OPTIONS.map((profile) => {
              const persona = getMemberPersona(profile);
              const seed = getPersonaTripSeed(profile);
              const member = profile !== "guest";

              return (
                <button
                  key={profile}
                  type="button"
                  className={clsx("home-demo-profile", `home-demo-profile-${persona.tierTone}`)}
                  onClick={() => onPlanAsProfile?.(profile)}
                  disabled={!onPlanAsProfile}
                >
                  <div className="home-demo-profile-head">
                    <span className="home-demo-profile-avatar" aria-hidden>
                      {member ? memberInitials(persona.displayName) : "?"}
                    </span>
                    <div>
                      <p className="home-demo-profile-name">{persona.displayName}</p>
                      <p className="home-demo-profile-program">{persona.programLabel}</p>
                    </div>
                    <span
                      className={clsx(
                        "home-demo-profile-tier",
                        `home-demo-profile-tier-${persona.tierTone}`,
                      )}
                    >
                      {persona.tierLabel}
                    </span>
                  </div>
                  <p className="home-demo-profile-intent">{persona.intentSummary}</p>
                  <blockquote className="home-demo-profile-quote">
                    &ldquo;{seed.briefText}&rdquo;
                  </blockquote>
                  <p className="home-demo-profile-meta">
                    {profile === "guest"
                      ? "Pick origin on the globe"
                      : `${originLabel(seed.origin)} · ${seed.monthHint}`}
                  </p>
                  <span className="home-demo-profile-cta">
                    {profile === "guest" ? "Start exploring →" : `Plan as ${persona.displayName} →`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="home-section home-section-muted">
        <div className="home-section-inner home-faq-wrap">
          <div>
            <p className="home-eyebrow">FAQ</p>
            <h2 className="home-heading">Quick answers</h2>
          </div>
          <dl className="home-faq">
            {FAQ.map((f) => (
              <div key={f.q} className="home-faq-item">
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="home-cta">
        <div className="home-section-inner home-cta-inner">
          <h2 className="home-cta-title">Ready to explore?</h2>
          <p className="home-cta-lead">Pick Minh, Alex, or a guest demo — trip context loads instantly.</p>
          {agentCanvasEnabled && onTalkToVeya ? (
            <Button className="mt-6 min-h-12 px-10 text-base" onClick={onTalkToVeya}>
              Talk to Veya
            </Button>
          ) : (
            <Button className="mt-6 min-h-12 px-10 text-base" onClick={onStart}>
              Start planning →
            </Button>
          )}
          <p className="home-cta-foot">We don&apos;t sell tickets — booking and payment on Vietnam Airlines.</p>
        </div>
      </section>
    </div>
  );
}
