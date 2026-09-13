import { useState } from "react";
import clsx from "clsx";
import type { OriginCity, TravelStyle } from "@shared/types";
import type { AgentWidget, DestinationHint, TripDraft } from "../../../lib/agentFlow";
import {
  DESTINATION_OPTIONS,
  ORIGIN_OPTIONS,
  VIBE_OPTIONS,
} from "../../../lib/agentFlow";
import { cityLabel } from "../../../lib/labels";
import { OriginGlobe } from "../../OriginGlobe";
import { Button } from "../../ui/Button";

function Chip({
  label,
  hint,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={clsx("chat-widget-chip", selected && "chat-widget-chip-on")}
      onClick={onClick}
    >
      <span className="chat-widget-chip-label">{label}</span>
      {hint ? <span className="chat-widget-chip-hint">{hint}</span> : null}
    </button>
  );
}

function ConfirmRow({
  label,
  disabled,
  onConfirm,
}: {
  label: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="chat-widget-confirm">
      <Button type="button" className="w-full" disabled={disabled} onClick={onConfirm}>
        {label}
      </Button>
    </div>
  );
}

export function ChatWidget({
  widget,
  draft,
  disabled,
  onPickOrigin,
  onPickVibe,
  onPickDestination,
  onPickTravellers,
}: {
  widget: AgentWidget;
  draft: TripDraft;
  disabled?: boolean;
  onPickOrigin: (v: OriginCity) => void;
  onPickVibe: (v: TravelStyle) => void;
  onPickDestination: (v: DestinationHint) => void;
  onPickTravellers: (n: number) => void;
}) {
  const [pendingOrigin, setPendingOrigin] = useState<OriginCity>(draft.origin ?? "SYD");
  const [pendingVibe, setPendingVibe] = useState<TravelStyle>(draft.travelStyle ?? "vfr");
  const [pendingDest, setPendingDest] = useState<DestinationHint>(
    draft.destinationHint ?? "family_south",
  );
  const [pendingTravellers, setPendingTravellers] = useState(draft.travellers || 2);

  if (widget.type === "pick_origin") {
    return (
      <div className="chat-widget chat-widget-origin">
        <div className="chat-origin-panel">
          <div className="chat-origin-globe-band">
            <div className="chat-origin-globe-layer">
              <OriginGlobe origin={pendingOrigin} />
            </div>
          </div>
          <div className="chat-origin-actions">
            <div className="chat-widget-chips chat-widget-chips-row">
              {ORIGIN_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={pendingOrigin === o.value}
                  disabled={disabled}
                  onClick={() => setPendingOrigin(o.value)}
                />
              ))}
            </div>
            <ConfirmRow
              label={`Choose ${cityLabel(pendingOrigin)}`}
              disabled={disabled}
              onConfirm={() => onPickOrigin(pendingOrigin)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (widget.type === "pick_vibe") {
    const vibeLabel =
      VIBE_OPTIONS.find((o) => o.value === pendingVibe)?.label ?? "this vibe";
    return (
      <div className="chat-widget">
        <div className="chat-widget-chips">
          {VIBE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              hint={o.hint}
              selected={pendingVibe === o.value}
              disabled={disabled}
              onClick={() => setPendingVibe(o.value)}
            />
          ))}
        </div>
        <ConfirmRow
          label={`Choose ${vibeLabel}`}
          disabled={disabled}
          onConfirm={() => onPickVibe(pendingVibe)}
        />
      </div>
    );
  }

  if (widget.type === "pick_destination") {
    const destLabel =
      DESTINATION_OPTIONS.find((o) => o.value === pendingDest)?.label ?? "this";
    return (
      <div className="chat-widget">
        <div className="chat-widget-chips">
          {DESTINATION_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              hint={o.hint}
              selected={pendingDest === o.value}
              disabled={disabled}
              onClick={() => setPendingDest(o.value)}
            />
          ))}
        </div>
        <ConfirmRow
          label={`Choose ${destLabel}`}
          disabled={disabled}
          onConfirm={() => onPickDestination(pendingDest)}
        />
      </div>
    );
  }

  if (widget.type === "pick_travellers") {
    return (
      <div className="chat-widget">
        <div className="chat-widget-chips chat-widget-chips-row">
          {[1, 2, 3, 4].map((n) => (
            <Chip
              key={n}
              label={`${n} ${n === 1 ? "adult" : "adults"}`}
              selected={pendingTravellers === n}
              disabled={disabled}
              onClick={() => setPendingTravellers(n)}
            />
          ))}
        </div>
        <ConfirmRow
          label={`Choose ${pendingTravellers} adult${pendingTravellers > 1 ? "s" : ""}`}
          disabled={disabled}
          onConfirm={() => onPickTravellers(pendingTravellers)}
        />
      </div>
    );
  }

  return null;
}
