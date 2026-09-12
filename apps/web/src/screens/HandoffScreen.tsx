import type { HandOffParams } from "@shared/types";
import { Button } from "../components/ui/Button";
import { cityLabel, formatShortDate } from "../lib/labels";

export function HandoffScreen({
  destinationName,
  imageUrl,
  handoff,
  onBack,
  onOpenSearch,
}: {
  destinationName: string;
  imageUrl: string;
  handoff: HandOffParams;
  onBack: () => void;
  onOpenSearch: () => void;
}) {
  const fields = [
    { label: "From", value: `${cityLabel(handoff.origin)} (${handoff.origin})` },
    { label: "To", value: `${cityLabel(handoff.destination)} (${handoff.destination})` },
    { label: "Depart", value: formatShortDate(handoff.departDate) },
    { label: "Return", value: formatShortDate(handoff.returnDate) },
    { label: "Adults", value: String(handoff.adults) },
  ];

  const steps = [
    "We open Vietnam Airlines flight search in a new tab",
    "Your origin, destination, dates & travellers are pre-filled",
    "You complete booking on the official VNA site — prices are live there",
  ];

  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative min-h-[220px] lg:min-h-0">
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/40 to-ink/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent lg:hidden" />
        <div className="relative flex h-full flex-col justify-end p-5 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
            Off to Vietnam Airlines
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">{destinationName}</h1>
          <p className="mt-2 max-w-md text-sm text-white/85">
            Ready to search flights on Vietnam Airlines with your trip details already filled in.
          </p>
          <div className="mt-4 hidden max-w-sm space-y-2 lg:block">
            {steps.map((s, i) => (
              <div key={s} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-xs text-white/80">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col bg-surface/90">
        <div className="border-b border-line/60 px-5 py-4">
          <h2 className="text-lg font-bold text-ink">Confirm search details</h2>
          <p className="mt-0.5 text-xs text-muted">
            Review before opening the official Vietnam Airlines booking search.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid gap-2 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.label} className="rounded-xl accent-teal px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {f.label}
                </dt>
                <dd className="mt-0.5 text-sm font-bold text-teal">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3 lg:hidden">
            <p className="text-[11px] font-semibold uppercase text-muted">What happens next</p>
            <ol className="mt-2 space-y-2">
              {steps.map((s, i) => (
                <li key={s} className="flex gap-2 text-xs text-muted">
                  <span className="font-bold text-teal">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 rounded-xl border border-teal/15 bg-teal/[0.04] px-3 py-2.5">
            <p className="text-xs text-muted">
              <span className="font-semibold text-ink">Note: </span>
              Veya is a discovery layer only. Fares, availability, and payment are handled entirely
              on vietnamairlines.com.
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-line/60 px-5 py-4">
          <Button className="w-full" onClick={onOpenSearch}>
            Open pre-filled search on VNA →
          </Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={onBack}>
            ← Back to routes
          </Button>
        </div>
      </div>
    </div>
  );
}
