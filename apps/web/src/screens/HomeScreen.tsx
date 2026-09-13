import type { DemoPersona } from "../lib/wizard";
import { VeyaLogo } from "../components/VeyaLogo";
import { Button } from "../components/ui/Button";

const DESTINATIONS = [
  {
    code: "DAD",
    name: "Da Nang",
    tag: "Beach & coast",
    blurb: "My Khe, Hoi An day trips, central coast.",
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
  { code: "SYD", city: "Sydney", note: "Fly to all three cities" },
  { code: "MEL", city: "Melbourne", note: "Nonstop to Hanoi & Saigon" },
  { code: "PER", city: "Perth", note: "Shorter flights westbound" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Three quick taps",
    body: "Where you’re flying from, the vibe, dates, and who’s going — about 30 seconds.",
  },
  {
    n: "02",
    title: "See your best matches",
    body: "Ranked routes into Hanoi, Ho Chi Minh City, or Da Nang — plus ideas for after you land.",
  },
  {
    n: "03",
    title: "Continue to book",
    body: "Open Vietnam Airlines with your dates and destination already filled in.",
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
    trip: "Visit family in Cà Mau — fly into Saigon, one stop max",
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
    q: "Do I book here?",
    a: "No — we help you choose where to fly in and what fits your trip. Prices and payment happen on Vietnam Airlines when you continue from the last step.",
  },
  {
    q: "Do I need to pick Hanoi vs Saigon first?",
    a: "Not necessarily. Tell us the vibe and dates; we suggest which city to fly into and why.",
  },
  {
    q: "Why Vietnam Airlines and not a comparison site?",
    a: "You still book with the airline. We only narrow down the right place to land and pass your trip details into their search so you don’t re-type everything.",
  },
  {
    q: "How long does it take?",
    a: "Three short steps — or tap Olivia, the Nguyens, or James to see example routes instantly.",
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
            <p className="hero-home-eyebrow">Australia → Vietnam</p>
            <h1 className="hero-home-title">Where should you fly in?</h1>
            <p className="hero-home-lead">
              Not sure Hanoi, Ho Chi Minh City, or Da Nang? Tell us your trip — we&apos;ll suggest
              the best place to land, then help you continue on Vietnam Airlines.
            </p>
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

      <section className="home-section home-ota-loss">
        <div className="home-section-inner">
          <p className="home-eyebrow">Why the city matters</p>
          <h2 className="home-heading">Same country, very different trips</h2>
          <ul className="home-ota-list">
            <li>Beach time near Da Nang is not the same as street food in Saigon or a week in Hanoi.</li>
            <li>The cheapest flight isn&apos;t always the right airport for what you want to do.</li>
            <li>We match your trip to a place you&apos;ll actually enjoy — then you pick flights on the airline site.</li>
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
          <p className="home-cta-foot">We don&apos;t sell tickets — booking and payment on Vietnam Airlines.</p>
        </div>
      </section>
    </div>
  );
}
