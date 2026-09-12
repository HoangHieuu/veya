import type { DemoPersona } from "../lib/wizard";
import { VeyaLogo } from "../components/VeyaLogo";
import { Button } from "../components/ui/Button";

const DESTINATIONS = [
  {
    code: "DAD",
    name: "Da Nang",
    tag: "Beach & coast",
    blurb: "My Khe, Hoi An day trips, central Vietnam gateway.",
    image:
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&q=80",
  },
  {
    code: "SGN",
    name: "Ho Chi Minh City",
    tag: "Food & city life",
    blurb: "Street food, districts, direct from Sydney & Melbourne.",
    image:
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&q=80",
  },
  {
    code: "HAN",
    name: "Hanoi",
    tag: "Culture & history",
    blurb: "Old Quarter, cool-season walks, northern Vietnam base.",
    image:
      "https://images.unsplash.com/photo-1509030450996-bdd17d7e1e9f?w=800&q=80",
  },
] as const;

const GATEWAYS = [
  { code: "SYD", city: "Sydney", note: "Main Oceania gateway" },
  { code: "MEL", city: "Melbourne", note: "Direct SGN & HAN" },
  { code: "PER", city: "Perth", note: "Shortest Australia haul" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Three quick taps",
    body: "Origin, trip vibe, when & who — about 30 seconds.",
  },
  {
    n: "02",
    title: "See ranked routes",
    body: "Hanoi, Saigon, or Da Nang — with reasons and a trip sketch.",
  },
  {
    n: "03",
    title: "Search on VNA",
    body: "We open vietnamairlines.com with your route pre-filled.",
  },
] as const;

const PERSONAS: {
  id: DemoPersona;
  name: string;
  from: string;
  trip: string;
  image: string;
  featured?: boolean;
}[] = [
  {
    id: "olivia",
    name: "Olivia",
    from: "Sydney",
    trip: "Beach-and-food with a friend, November, low hassle",
    image:
      "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&q=80",
    featured: true,
  },
  {
    id: "vfr",
    name: "The Nguyens",
    from: "Melbourne",
    trip: "Family visit with kids, flexible ±3 days, one stop max",
    image:
      "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&q=80",
  },
  {
    id: "student",
    name: "James",
    from: "Perth",
    trip: "Food-focused long weekend, budget-conscious, solo",
    image:
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80",
  },
];

const FAQ = [
  {
    q: "Is this a booking site?",
    a: "No. Veya is a discovery layer only. Fares, seats, and payment happen on the official Vietnam Airlines website.",
  },
  {
    q: "Do I need to know my destination?",
    a: "Not at all. That's the point — tell us the vibe and constraints, and we'll suggest where to start.",
  },
  {
    q: "How long does the form take?",
    a: "Three short steps — or skip straight to demo routes with Olivia, the Nguyens, or James.",
  },
];

const OLIVIA_EXAMPLE =
  "I have 8–10 days free in November from Sydney. Beach-and-food trip with a friend — low hassle, few connections.";

export function HomeScreen({
  onStart,
  onTryExample,
}: {
  onStart: () => void;
  onTryExample: (persona: DemoPersona) => void;
}) {
  const olivia = PERSONAS.find((p) => p.id === "olivia")!;
  const others = PERSONAS.filter((p) => !p.featured);

  return (
    <div className="h-full overflow-y-auto">
      <section className="hero-home">
        <a href="/" className="home-brand" onClick={(e) => e.preventDefault()}>
          <VeyaLogo size="md" />
        </a>

        <div className="hero-home-bg pointer-events-none" aria-hidden />

        <div className="hero-home-inner">
          <div className="hero-home-copy anim-rise">
            <p className="hero-home-eyebrow">Vietnam Airlines · Australia</p>
            <h1 className="hero-home-title">Explore Vietnam</h1>
            <p className="hero-home-lead">Your route, ranked.</p>
            <div className="hero-home-actions">
              <Button className="min-h-12 px-8 text-base" onClick={onStart}>
                Start planning →
              </Button>
              <button
                type="button"
                onClick={() => onTryExample("olivia")}
                className="text-sm font-semibold text-teal transition hover:text-teal/80"
              >
                See Olivia&apos;s routes instantly
              </button>
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

      <section className="home-section home-section-muted">
        <div className="home-section-inner">
          <p className="home-eyebrow">Destinations</p>
          <h2 className="home-heading">Where we rank routes</h2>
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

      <section className="home-section">
        <div className="home-section-inner">
          <p className="home-eyebrow">Real trip ideas</p>
          <h2 className="home-heading">Messy, human, totally fine</h2>
          <p className="home-personas-lead">
            Tap a story — ranked routes in one click, no form.
          </p>

          <article className="home-olivia">
            <div className="home-olivia-visual">
              <img src={olivia.image} alt="" />
            </div>
            <div className="home-olivia-body">
              <p className="home-olivia-label">Try the demo</p>
              <h3 className="home-olivia-title">
                {olivia.name} · {olivia.from}
              </h3>
              <blockquote className="home-olivia-quote">&ldquo;{OLIVIA_EXAMPLE}&rdquo;</blockquote>
              <Button
                variant="secondary"
                className="mt-5"
                onClick={() => onTryExample("olivia")}
              >
                See her routes →
              </Button>
            </div>
          </article>

          <div className="home-personas-grid">
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                className="home-persona-card"
                onClick={() => onTryExample(p.id)}
              >
                <img src={p.image} alt="" className="home-persona-img" />
                <div className="home-persona-overlay" />
                <div className="home-persona-body">
                  <p className="home-persona-name">
                    {p.name} · {p.from}
                  </p>
                  <p className="home-persona-trip">&ldquo;{p.trip}&rdquo;</p>
                  <span className="home-persona-cta">Try this trip →</span>
                </div>
              </button>
            ))}
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
          <p className="home-cta-lead">Three taps. Your ranked routes.</p>
          <Button className="mt-6 min-h-12 px-10 text-base" onClick={onStart}>
            Start planning →
          </Button>
          <p className="home-cta-foot">Discovery only · booking on vietnamairlines.com</p>
        </div>
      </section>
    </div>
  );
}
