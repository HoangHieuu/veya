import type { ReactNode } from "react";

import type { OriginCity, PriorityPreset, TravelStyle } from "@shared/types";

import { OptionGrid } from "./OptionGrid";

import { PRIORITY_OPTIONS } from "../lib/labels";

import { WIZARD_STEPS, type TripWizardState } from "../lib/wizard";



const ORIGINS: { code: OriginCity; city: string; hint: string }[] = [

  { code: "SYD", city: "Sydney", hint: "SYD · All Vietnam routes" },

  { code: "MEL", city: "Melbourne", hint: "MEL · Direct to SGN & HAN" },

  { code: "PER", city: "Perth", hint: "PER · Shortest haul to Asia" },

];



const VIBE_OPTIONS: { value: TravelStyle; label: string; hint: string }[] = [

  { value: "beach_relaxation", label: "Beach & coast", hint: "Central or southern coast" },

  { value: "food_culture", label: "Food & streets", hint: "Saigon or Hanoi" },

  { value: "vfr", label: "Visit family", hint: "North or south hubs" },

  { value: "family", label: "Family holiday", hint: "Easy pacing" },

  { value: "education", label: "Culture & learning", hint: "History & museums" },

  { value: "mixed", label: "Mix of everything", hint: "City + coast" },

];



const TRAVELLER_PRESETS = [

  { value: 1, label: "Just me", hint: "Solo" },

  { value: 2, label: "Two", hint: "Couple or friend" },

  { value: 4, label: "Small group", hint: "3–4 people" },

  { value: 6, label: "Family", hint: "5+ people" },

];



const DATE_OPTIONS = [

  { value: "flexible_±3" as const, label: "Rough dates, ±3 days", hint: "Most common" },

  { value: "flexible_month" as const, label: "Flexible this month", hint: "Season or hols" },

  { value: "fixed" as const, label: "I know my dates", hint: "Specific dates" },

];



const BUDGET_OPTIONS = [

  { value: "budget" as const, label: "Budget", hint: "Keep costs down" },

  { value: "standard" as const, label: "Standard", hint: "Balanced" },

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



    case "vibe":

      return (

        <FieldWithDescribe

          options={

            <OptionGrid

              compact

              columns={2}

              options={VIBE_OPTIONS.map((o) => ({

                value: o.value,

                label: o.label,

                hint: o.hint,

                selected: wizard.travelStyle === o.value,

              }))}

              onSelect={(v) => onPatch({ travelStyle: v as TravelStyle })}

            />

          }

          label="Anything specific?"

          value={wizard.vibeDescribe ?? ""}

          onChange={(v) => onPatch({ vibeDescribe: v })}

          placeholder="e.g. Vung Tau, Hoi An…"

        />

      );



    case "details":

      return (

        <div className="space-y-3">

          <OptionGrid

            compact

            columns={1}

            options={DATE_OPTIONS.map((o) => ({

              value: o.value,

              label: o.label,

              hint: o.hint,

              selected: (wizard.dateFlexibility ?? "flexible_±3") === o.value,

            }))}

            onSelect={(v) =>

              onPatch({ dateFlexibility: v as TripWizardState["dateFlexibility"] })

            }

          />

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

        </div>

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


