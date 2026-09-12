# Veya — Google Stitch design brief (rough)

Paste this into Google Stitch as the product / UI brief.

---

## Product one-liner
**Veya** is a light, modern trip-discovery layer for Vietnam Airlines’ Australia site. Travellers type a vague trip idea (or finish a short quiz); Veya ranks 3 Vietnam Airlines–compatible routes and hands them into the official flight search with origin / destination / dates pre-filled. It does **not** redesign booking or payment.

## Users
- Primary: leisure / VFR / student travellers in Australia (Sydney, Melbourne, Perth) who have not chosen a destination yet.
- Pilot persona: Olivia in Sydney, 8–10 days in November, beach + food, low hassle, travelling with a friend.

## Screens to design (3)

### 1) Intent (split workspace, full viewport)
- **Left ~40%:** glass panel — brand “Veya”, step indicator (01 Intent · 02 Routes · 03 Search), tabs Brief | Quiz, origin chips SYD / MEL / PER, large textarea (or 5 quiz fields), primary CTA “Show matching routes”.
- **Right ~60%:** oversized soft **WebGL globe** (COBE-style, light theme) filling most of the panel; flight **arcs from selected AU city → Hanoi / Ho Chi Minh City / Da Nang**; three small glass destination chips at the bottom (HAN, SGN, DAD). Soft headline over the globe: “See your corridor before you pick a city.”

### 2) Routes (results)
- Top bar: paraphrased trip intent + priority chips (Lowest hassle / Best for family / Maximise miles / Food & culture) + “Edit intent”.
- Soft warning banner if any route data is “illustrative”.
- **#1 Best match:** large horizontal feature — destination photo left, “why this fits” bullets + getting around + season + CTAs “Continue to search” / “Save route” on the right. Not three equal cards.
- **#2 and #3:** dense horizontal rows (thumbnail + meta + short reason + Search / Save).
- Optional tiny “Judge scores” toggle (dev), not prominent.

### 3) Hand-off
- Split: destination image | confirmation of pre-filled search fields (origin, destination, depart, return, adults).
- Primary: “Open pre-filled search”. Secondary: “Back to routes”.
- Copy clarifies booking stays on Vietnam Airlines.

## Visual system (important)
- **Light theme only** — airy, calm, premium travel product (not dark SaaS, not purple AI gradient).
- Background: soft multi-stop wash (cool blue-grey + warm peach hints), **very light film grain / noise**.
- Surfaces: **glassmorphism** — frosted white panels, translucent borders, subtle inner highlight; **soft rounded corners** (≈16–20px), smooth and friendly.
- Accent: warm sunset orange `#FF6A2B` (energy, CTAs, active arcs). Supporting sky blue for secondary arcs / links.
- Typography: distinctive geometric display + clean humanist sans (e.g. Bricolage Grotesque + Public Sans). Large destination names; compact meta labels in uppercase tracking.
- Imagery: real travel photography for destinations; globe is the hero visual on Intent.
- Motion (describe, don’t overdo): slow globe drift, soft fade/rise on content, gentle image ken-burns on featured route.
- Avoid: equal card grids, rainbow badges, heavy drop shadows, neon glow, Inter-default SaaS look, dark mode.

## Information that must stay visible
- Connection type (Direct / 1 stop) and Confirmed vs Illustrative.
- Route line (e.g. SYD → DAD via SGN), duration, dates, travellers.
- “Why this fits” reasons grounded in trip intent.
- Getting-around note; seasonality; promo / Lotusmiles only if present.
- Clear that this is discovery → official search, not a fake booking.

## Success look
Feels like a polished airline digital product: bright, spacious, informative, one clear next action per screen, globe making Australia→Vietnam paths emotionally clear before recommendations appear.

---

## Optional Stitch prompts (short)

**Intent screen:**
“Light-theme full-viewport travel app. Left frosted glass form for trip brief with SYD/MEL/PER chips. Right oversized soft WebGL globe with orange arcs from Sydney to Vietnam cities, grain and soft gradients, rounded glass destination chips. Modern, airy, not dark, not purple.”

**Results screen:**
“Light travel UI results: one large featured destination recommendation with photo and reasons, two compact route rows below, priority filter chips, soft orange accent, glass panels, subtle grain, no equal three-column cards.”
