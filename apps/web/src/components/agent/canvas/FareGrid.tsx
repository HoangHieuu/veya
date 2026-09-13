import { useState } from "react";
import clsx from "clsx";
import type { CabinClass, FareOption } from "@shared/types";
import { formatAud } from "../../../lib/agentSession";

const CABIN_ORDER: CabinClass[] = ["economy", "premium_economy", "business"];

const CABIN_LABEL: Record<CabinClass, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
};

function groupByCabin(options: FareOption[]): [CabinClass, FareOption[]][] {
  return CABIN_ORDER.map((cabin) => [
    cabin,
    options.filter((option) => option.cabin === cabin),
  ] as [CabinClass, FareOption[]]).filter(([, items]) => items.length > 0);
}

function FareColumn({
  option,
  selected,
  travellers,
  disabled,
  onSelect,
}: {
  option: FareOption;
  selected: boolean;
  travellers: number;
  disabled: boolean;
  onSelect: () => void;
}) {
  const [showRules, setShowRules] = useState(false);

  return (
    <div className={clsx("vna-fare", selected && "vna-fare-selected")}>
      <header className="vna-fare-head">
        <span className="vna-fare-brand">{option.brandLabel}</span>
        {option.lowest ? <span className="vna-fare-flag">Lowest fare</span> : null}
      </header>

      <p className="vna-fare-price">
        <span className="vna-fare-amount">{formatAud(option.pricePerAdultAud)}</span>
        <span className="vna-fare-unit">per adult, return</span>
      </p>
      {travellers > 1 ? (
        <p className="vna-fare-total">{formatAud(option.totalAud)} total</p>
      ) : null}

      <ul className="vna-fare-perks">
        {option.perks.map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>

      {option.seatsRemaining !== undefined && option.seatsRemaining <= 5 ? (
        <p className="vna-fare-seats">{option.seatsRemaining} seats left at this fare</p>
      ) : null}

      <button
        type="button"
        className={clsx("vna-fare-select", selected && "vna-fare-select-on")}
        disabled={disabled}
        aria-pressed={selected}
        onClick={onSelect}
      >
        {selected ? "Selected" : "Select"}
      </button>

      <button
        type="button"
        className="vna-fare-rules-toggle"
        aria-expanded={showRules}
        onClick={() => setShowRules((open) => !open)}
      >
        {showRules ? "Hide fare conditions" : "Fare conditions"}
      </button>

      {showRules ? (
        <dl className="vna-fare-rules">
          {option.rules.map((rule) => (
            <div key={rule.label} className="vna-fare-rule">
              <dt>{rule.label}</dt>
              <dd>
                {rule.value}
                {rule.illustrative ? (
                  <span className="vna-fare-rule-flag" title={rule.source}>
                    illustrative
                  </span>
                ) : (
                  <span
                    className="vna-fare-rule-flag vna-fare-rule-flag-real"
                    title={rule.source}
                  >
                    VNA published
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * Branded fare grid modelled on the Vietnam Airlines availability page: fares
 * grouped by cabin, one column per brand, price per adult with the party total
 * underneath, and expandable fare conditions.
 */
export function FareGrid({
  options,
  selectedBrandId,
  travellers,
  busy,
  onSelect,
}: {
  options: FareOption[];
  selectedBrandId?: string;
  travellers: number;
  busy?: boolean;
  onSelect: (option: FareOption) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="agent-canvas-muted">
        No fares are available for this route yet.
      </p>
    );
  }

  return (
    <div className="vna-fare-grid">
      {groupByCabin(options).map(([cabin, items]) => (
        <section key={cabin} className="vna-fare-cabin">
          <h4 className="vna-fare-cabin-label">{CABIN_LABEL[cabin]}</h4>
          <div className="vna-fare-columns">
            {items.map((option) => (
              <FareColumn
                key={option.brandId}
                option={option}
                selected={option.brandId === selectedBrandId}
                travellers={travellers}
                disabled={Boolean(busy)}
                onSelect={() => onSelect(option)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
