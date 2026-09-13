import type { LocalityResolution } from "../../../lib/agentTypes";

export function VfrAfterLanding({
  locality,
  gatewayAirport,
}: {
  locality?: LocalityResolution;
  gatewayAirport: string;
}) {
  const place = locality?.localityTitle ?? "your family";

  const steps = [
    {
      title: `Land at ${gatewayAirport}`,
      detail: "Complete immigration and collect bags at the VNA gateway.",
    },
    {
      title: `Onward to ${place}`,
      detail:
        locality?.onwardNote ??
        "Plan road transfer or a domestic VNA connection to reach your relatives.",
    },
    {
      title: "Book international first",
      detail: "Veya pre-fills the long-haul leg — onward travel you arrange after landing.",
    },
  ];

  return (
    <section className="agent-canvas-block agent-vfr-steps" aria-label="After you land">
      <h3 className="agent-canvas-label">After you land</h3>
      <ol className="agent-vfr-list">
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className="agent-vfr-num">{i + 1}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
