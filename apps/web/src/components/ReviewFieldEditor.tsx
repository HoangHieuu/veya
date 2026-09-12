import type { ReactNode } from "react";
import type { OriginCity, PriorityPreset, TravelStyle } from "@shared/types";
import { OptionGrid } from "./OptionGrid";
import { PRIORITY_OPTIONS, TRAVEL_STYLE_OPTIONS } from "../lib/labels";
import { WIZARD_STEPS, type TripWizardState } from "../lib/wizard";

const ORIGINS: { code: OriginCity; city: string; hint: string }[] = [
  { code: "SYD", city: "Sydney", hint: "SYD · Main gateway" },
  { code: "MEL", city: "Melbourne", hint: "MEL · Direct to SGN & HAN" },
  { code: "PER", city: "Perth", hint: "PER · Shortest haul to Asia" },
];

const TRAVELLER_PRESETS = [
  { value: 1, label: "Just me", hint: "Solo trip" },
  { value: 2, label: "Two of us", hint: "Couple or friend" },
  { value: 4, label: "Small group", hint: "3–4 people" },
  { value: 6, label: "Family / group", hint: "5+ people" },
];

const DATE_OPTIONS = [
  { value: "fixed" as const, label: "I know my dates", hint: "Specific depart & return" },
  { value: "flexible_±3" as const, label: "Rough dates, ±3 days OK", hint: "Most common" },
  { value: "flexible_month" as const, label: "Flexible within a month", hint: "Season or school hols" },
];

const BUDGET_OPTIONS = [
  { value: "budget" as const, label: "Budget", hint: "Keep costs down" },
  { value: "standard" as const, label: "Standard", hint: "Balanced value" },
  { value: "premium" as const, label: "Premium", hint: "Comfort first" },
];

export function ReviewFieldEditor({
  stepIndex,
  wizard,
  onPatch,
}: {
  stepIndex: number;
  wizard: TripWizardState;
  onPatch: (p: Partial<TripWizardState>) => void;
}) {
  const stepId = WIZARD_STEPS[stepIndex]?.id;

  switch (stepId) {
    case "origin":
      return (
        <OptionGrid
          compact
          columns={3}
          options={ORIGINS.map((o) => ({
            value: o.code,
            label: o.city,
            hint: o.hint,
            selected: wizard.originCity === o.code,
          }))}
          onSelect={(v) => onPatch({ originCity: v as OriginCity })}
        />
      );

    case "who":
      return (
        <div className="space-y-2">
          <OptionGrid
            compact
            columns={2}
            options={TRAVELLER_PRESETS.map((p) => ({
              value: String(p.value),
              label: p.label,
              hint: p.hint,
              selected: wizard.travellers === p.value,
            }))}
            onSelect={(v) => onPatch({ travellers: Number(v) })}
          />
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
            <span className="text-xs text-muted">Exact count:</span>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-base font-bold text-teal"
              onClick={() => onPatch({ travellers: Math.max(1, wizard.travellers - 1) })}
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center text-base font-bold">{wizard.travellers}</span>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-base font-bold text-teal"
              onClick={() => onPatch({ travellers: Math.min(9, wizard.travellers + 1) })}
            >
              +
            </button>
          </div>
        </div>
      );

    case "when":
      return (
        <FieldWithDescribe
          options={
            <OptionGrid
              compact
              columns={1}
              options={DATE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                hint: o.hint,
                selected: wizard.dateFlexibility === o.value,
              }))}
              onSelect={(v) =>
                onPatch({ dateFlexibility: v as TripWizardState["dateFlexibility"] })
              }
            />
          }
          label="Or describe your dates"
          value={wizard.dateDescribe ?? ""}
          onChange={(v) => onPatch({ dateDescribe: v })}
          placeholder="e.g. 8–10 days in November…"
        />
      );

    case "vibe":
      return (
        <FieldWithDescribe
          options={
            <OptionGrid
              compact
              columns={2}
              options={TRAVEL_STYLE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                selected: wizard.travelStyle === o.value,
              }))}
              onSelect={(v) => onPatch({ travelStyle: v as TravelStyle })}
            />
          }
          label="Or describe the vibe"
          value={wizard.vibeDescribe ?? ""}
          onChange={(v) => onPatch({ vibeDescribe: v })}
          placeholder="e.g. Beach-and-food, low hassle…"
        />
      );

    case "budget":
      return (
        <FieldWithDescribe
          options={
            <OptionGrid
              compact
              columns={3}
              options={BUDGET_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                hint: o.hint,
                selected: wizard.budgetBand === o.value,
              }))}
              onSelect={(v) => onPatch({ budgetBand: v as TripWizardState["budgetBand"] })}
            />
          }
          label="Or describe your budget"
          value={wizard.budgetDescribe ?? ""}
          onChange={(v) => onPatch({ budgetDescribe: v })}
          placeholder="e.g. Under $1,500 per person…"
        />
      );

    case "priority":
      return (
        <FieldWithDescribe
          options={
            <OptionGrid
              compact
              columns={2}
              options={PRIORITY_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                selected: wizard.priority === o.value,
              }))}
              onSelect={(v) => onPatch({ priority: v as PriorityPreset })}
            />
          }
          label="Or describe what matters most"
          value={wizard.priorityDescribe ?? ""}
          onChange={(v) => onPatch({ priorityDescribe: v })}
          placeholder="e.g. Fewest connections…"
        />
      );

    default:
      return null;
  }
}

function FieldWithDescribe({
  options,
  label,
  value,
  onChange,
  placeholder,
}: {
  options: ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-3">
      {options}
      <div className="border-t border-line/60 pt-3">
        <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
        <textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-y rounded-2xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed placeholder:text-muted-2 focus:border-teal/40 focus:outline-none focus:ring-2 focus:ring-teal/10"
        />
      </div>
    </div>
  );
}
