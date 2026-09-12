import { useEffect, useRef, type ReactNode } from "react";
import type { OriginCity, PriorityPreset, TravelStyle } from "@shared/types";
import { OptionGrid } from "../components/OptionGrid";
import { OriginStepPanel } from "../components/OriginStepPanel";
import { ReviewSummary } from "../components/ReviewSummary";
import { WizardStepCard } from "../components/WizardStepCard";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PRIORITY_OPTIONS, TRAVEL_STYLE_OPTIONS } from "../lib/labels";
import {
  canAdvanceWizard,
  canCompleteStep,
  WIZARD_STEPS,
  wizardStepSummary,
  type TripWizardState,
  type WizardStepId,
} from "../lib/wizard";
const ORIGINS: { code: OriginCity; city: string; hint: string }[] = [
  { code: "SYD", city: "Sydney", hint: "Main gateway" },
  { code: "MEL", city: "Melbourne", hint: "Direct to SGN & HAN" },
  { code: "PER", city: "Perth", hint: "Shortest haul to Asia" },
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

export function TripWizardScreen({
  wizard,
  loading,
  errorMessage,
  onChange,
  onSubmit,
  onBack,
}: {
  wizard: TripWizardState;
  loading: boolean;
  errorMessage?: string;
  onChange: (w: TripWizardState) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const activeStep = WIZARD_STEPS[wizard.stepIndex];
  const canNext = canAdvanceWizard(wizard);
  const isReview = activeStep?.id === "review";
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevStepIndex = useRef(wizard.stepIndex);

  function patch(p: Partial<TripWizardState>) {
    onChange({ ...wizard, ...p });
  }

  function goNext() {
    if (!canNext || isReview) return;
    const next = Math.min(wizard.stepIndex + 1, WIZARD_STEPS.length - 1);
    patch({
      stepIndex: next,
      furthestStep: Math.max(wizard.furthestStep, next),
    });
  }

  function editStep(index: number) {
    if (index > wizard.furthestStep) return;
    patch({ stepIndex: index });
  }

  useEffect(() => {
    const moved = prevStepIndex.current !== wizard.stepIndex;
    prevStepIndex.current = wizard.stepIndex;
    if (!moved) return;

    const el = stepRefs.current[wizard.stepIndex];
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [wizard.stepIndex]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {activeStep?.vibe ? (
        <div className="shrink-0 border-b border-line/40 bg-surface/50 px-4 py-2 text-center md:px-6">
          <p className="text-xs font-medium text-teal">{activeStep.vibe}</p>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Your trip to Vietnam
            </h1>
            <p className="mt-2 text-sm text-muted">
              Tap through each step — on review, use the edit icon to change any row inline.
            </p>
          </div>

          {errorMessage && isReview ? (
            <div className="mb-4">
              <Alert tone="error">{errorMessage}</Alert>
            </div>
          ) : null}

          <div className="space-y-3">
            {WIZARD_STEPS.map((step, index) => {
              const state =
                index === wizard.stepIndex
                  ? "active"
                  : index <= wizard.furthestStep && canCompleteStep(wizard, step.id)
                    ? "completed"
                    : "locked";

              return (
                <WizardStepCard
                  key={step.id}
                  cardRef={(el) => {
                    stepRefs.current[index] = el;
                  }}
                  title={step.title}
                  subtitle={step.subtitle}
                  vibe={step.vibe}
                  state={state}
                  summary={wizardStepSummary(wizard, step.id)}
                  onEdit={() => editStep(index)}
                >
                  {renderStepBody(step.id, wizard, patch)}
                </WizardStepCard>
              );
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-line/60 bg-surface/90 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Button variant="secondary" className="flex-1 sm:flex-none sm:px-8" onClick={onBack}>
            ← Home
          </Button>
          {isReview ? (
            <Button className="flex-[2]" disabled={loading} onClick={onSubmit}>
              {loading ? "Finding routes…" : "Find my routes →"}
            </Button>
          ) : (
            <Button className="flex-[2]" disabled={!canNext} onClick={goNext}>
              Continue →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function renderStepBody(
  stepId: WizardStepId,
  wizard: TripWizardState,
  patch: (p: Partial<TripWizardState>) => void,
) {
  switch (stepId) {
    case "origin":
      return (
        <OriginStepPanel origin={wizard.originCity}>
          <OptionGrid
            columns={3}
            options={ORIGINS.map((o) => ({
              value: o.code,
              label: o.city,
              hint: `${o.code} · ${o.hint}`,
              selected: wizard.originCity === o.code,
            }))}
            onSelect={(v) => patch({ originCity: v as OriginCity })}
          />
        </OriginStepPanel>
      );

    case "who":
      return (
        <div className="space-y-3">
          <OptionGrid
            columns={2}
            options={TRAVELLER_PRESETS.map((p) => ({
              value: String(p.value),
              label: p.label,
              hint: p.hint,
              selected: wizard.travellers === p.value,
            }))}
            onSelect={(v) => patch({ travellers: Number(v) })}
          />
          <div className="flex items-center justify-center gap-3 rounded-3xl border border-line bg-surface px-4 py-2.5">
            <span className="text-sm text-muted">Or set exactly:</span>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-lg font-bold text-teal"
              onClick={() => patch({ travellers: Math.max(1, wizard.travellers - 1) })}
            >
              −
            </button>
            <span className="min-w-[2rem] text-center text-lg font-bold">{wizard.travellers}</span>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-lg font-bold text-teal"
              onClick={() => patch({ travellers: Math.min(9, wizard.travellers + 1) })}
            >
              +
            </button>
          </div>
        </div>
      );

    case "when":
      return (
        <OptionsAndDescribe
          options={
            <OptionGrid
              columns={1}
              options={DATE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                hint: o.hint,
                selected: wizard.dateFlexibility === o.value,
              }))}
              onSelect={(v) =>
                patch({ dateFlexibility: v as TripWizardState["dateFlexibility"] })
              }
            />
          }
          label="Or describe your dates"
          value={wizard.dateDescribe ?? ""}
          onChange={(v) => patch({ dateDescribe: v })}
          placeholder="e.g. 8–10 days in November, school holidays, or anytime in March…"
        />
      );

    case "vibe":
      return (
        <OptionsAndDescribe
          options={
            <OptionGrid
              columns={2}
              options={TRAVEL_STYLE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                selected: wizard.travelStyle === o.value,
              }))}
              onSelect={(v) => patch({ travelStyle: v as TravelStyle })}
            />
          }
          label="Or describe the vibe"
          value={wizard.vibeDescribe ?? ""}
          onChange={(v) => patch({ vibeDescribe: v })}
          placeholder="e.g. Beach-and-food with a friend, low hassle, not too touristy…"
        />
      );

    case "budget":
      return (
        <OptionsAndDescribe
          options={
            <OptionGrid
              columns={3}
              options={BUDGET_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                hint: o.hint,
                selected: wizard.budgetBand === o.value,
              }))}
              onSelect={(v) => patch({ budgetBand: v as TripWizardState["budgetBand"] })}
            />
          }
          label="Or describe your budget"
          value={wizard.budgetDescribe ?? ""}
          onChange={(v) => patch({ budgetDescribe: v })}
          placeholder="e.g. Happy to pay more for direct flights, or keeping it under $1,500…"
        />
      );

    case "priority":
      return (
        <OptionsAndDescribe
          options={
            <OptionGrid
              columns={2}
              options={PRIORITY_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                selected: wizard.priority === o.value,
              }))}
              onSelect={(v) => patch({ priority: v as PriorityPreset })}
            />
          }
          label="Or describe what matters most"
          value={wizard.priorityDescribe ?? ""}
          onChange={(v) => patch({ priorityDescribe: v })}
          placeholder="e.g. Fewest connections, good for kids, or maximising Lotusmiles…"
        />
      );

    case "review":
      return (
        <div className="space-y-4">
          <ReviewSummary wizard={wizard} onPatch={patch} />
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">
              Anything else we should know? <span className="text-muted">(optional)</span>
            </label>
            <DescribeBox
              value={wizard.extraNotes ?? ""}
              onChange={(v) => patch({ extraNotes: v })}
              placeholder="Connections you won't tolerate, must-see places, accessibility needs…"
              rows={3}
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

function OptionsAndDescribe({
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
    <div className="space-y-4">
      {options}
      <div className="border-t border-line/60 pt-4">
        <label className="mb-2 block text-sm font-medium text-muted">{label}</label>
        <DescribeBox value={value} onChange={onChange} placeholder={placeholder} rows={3} />
      </div>
    </div>
  );
}

function DescribeBox({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-y rounded-3xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted-2 focus:border-teal/40 focus:outline-none focus:ring-2 focus:ring-teal/10"
    />
  );
}
