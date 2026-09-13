import { useEffect, useRef, useState } from "react";
import type { OriginCity, PriorityPreset, TravelStyle } from "@shared/types";
import { OptionGrid } from "../components/OptionGrid";
import { OriginStepPanel } from "../components/OriginStepPanel";
import {
  WizardProgress,
  WizardProgressDots,
} from "../components/layout/WizardProgress";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PRIORITY_OPTIONS } from "../lib/labels";
import {
  canAdvanceWizard,
  WIZARD_STEPS,
  wizardTripSummary,
  type TripWizardState,
  type WizardStepId,
} from "../lib/wizard";

const ORIGINS: { code: OriginCity; city: string; hint: string }[] = [
  { code: "SYD", city: "Sydney", hint: "Routes to all three cities" },
  { code: "MEL", city: "Melbourne", hint: "Nonstop to Hanoi & Saigon" },
  { code: "PER", city: "Perth", hint: "Shortest haul to Asia" },
];

const VIBE_OPTIONS: {
  value: TravelStyle;
  label: string;
  hint: string;
}[] = [
  {
    value: "beach_relaxation",
    label: "Beach & coast",
    hint: "Da Nang coast or southern beaches via Saigon",
  },
  {
    value: "food_culture",
    label: "Food & streets",
    hint: "Saigon nights or Hanoi Old Quarter",
  },
  {
    value: "vfr",
    label: "Visit family",
    hint: "North or south hubs for relatives",
  },
  {
    value: "family",
    label: "Family holiday",
    hint: "Easy transfers, kid-friendly pacing",
  },
  {
    value: "education",
    label: "Culture & learning",
    hint: "Museums, history, local life",
  },
  {
    value: "mixed",
    label: "Mix of everything",
    hint: "City + coast + food in one trip",
  },
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
  { value: "fixed" as const, label: "I know my dates", hint: "Specific depart & return" },
];

const BUDGET_OPTIONS = [
  { value: "budget" as const, label: "Budget", hint: "Keep costs down" },
  { value: "standard" as const, label: "Standard", hint: "Balanced" },
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
  const isLastStep = wizard.stepIndex === WIZARD_STEPS.length - 1;
  const panelRef = useRef<HTMLDivElement>(null);

  function patch(p: Partial<TripWizardState>) {
    onChange({ ...wizard, ...p });
  }

  function goNext() {
    if (!canNext || isLastStep) return;
    const next = wizard.stepIndex + 1;
    patch({
      stepIndex: next,
      furthestStep: Math.max(wizard.furthestStep, next),
      dateFlexibility: wizard.dateFlexibility ?? "flexible_±3",
    });
  }

  function goPrev() {
    if (wizard.stepIndex === 0) {
      onBack();
      return;
    }
    patch({ stepIndex: wizard.stepIndex - 1 });
  }

  function jumpToStep(index: number) {
    if (index > wizard.furthestStep) return;
    patch({ stepIndex: index });
  }

  useEffect(() => {
    panelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [wizard.stepIndex]);

  return (
    <div className="wizard-shell flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line/50 bg-surface/80 px-4 py-3 md:px-6">
        <div className="mx-auto max-w-xl">
          <WizardProgress
            stepIndex={wizard.stepIndex}
            total={WIZARD_STEPS.length}
            label={activeStep?.title ?? "Your trip"}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
          <WizardProgressDots
            stepIndex={wizard.stepIndex}
            total={WIZARD_STEPS.length}
            className="mb-5 justify-center"
          />

          {wizard.furthestStep > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {WIZARD_STEPS.map((step, index) => {
                if (index > wizard.furthestStep || index === wizard.stepIndex) return null;
                const summary = wizardTripSummary(wizard);
                if (index === 0) {
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => jumpToStep(index)}
                      className="wizard-chip-edit rounded-full border border-line/80 bg-surface-2/80 px-3 py-1 text-xs font-medium text-muted transition hover:border-teal/30 hover:text-teal"
                    >
                      {ORIGINS.find((o) => o.code === wizard.originCity)?.city ?? wizard.originCity}
                    </button>
                  );
                }
                if (index === 1 && wizard.travelStyle) {
                  const vibe = VIBE_OPTIONS.find((v) => v.value === wizard.travelStyle);
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => jumpToStep(index)}
                      className="wizard-chip-edit rounded-full border border-line/80 bg-surface-2/80 px-3 py-1 text-xs font-medium text-muted transition hover:border-teal/30 hover:text-teal"
                    >
                      {vibe?.label ?? "Trip vibe"}
                    </button>
                  );
                }
                if (index === 2 && summary) {
                  return null;
                }
                return null;
              })}
            </div>
          ) : null}

          <div ref={panelRef} className="wizard-single-step anim-rise">
            <header className="mb-5">
              <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[1.65rem]">
                {activeStep?.title}
              </h1>
              <p className="mt-1.5 text-sm text-muted">{activeStep?.subtitle}</p>
            </header>

            {errorMessage && isLastStep ? (
              <div className="mb-4">
                <Alert tone="error">{errorMessage}</Alert>
              </div>
            ) : null}

            {renderStepBody(activeStep?.id, wizard, patch)}

            {isLastStep && canNext ? (
              <p className="mt-5 rounded-2xl border border-line/60 bg-surface-2/60 px-4 py-3 text-sm text-muted">
                <span className="font-medium text-ink">{wizardTripSummary(wizard)}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-line/60 bg-surface/90 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-xl gap-3">
          <Button variant="secondary" className="flex-1 sm:flex-none sm:px-8" onClick={goPrev}>
            {wizard.stepIndex === 0 ? "← Home" : "← Back"}
          </Button>
          {isLastStep ? (
            <Button className="flex-[2]" disabled={!canNext || loading} onClick={onSubmit}>
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
  stepId: WizardStepId | undefined,
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

    case "vibe":
      return (
        <div className="space-y-4">
          <OptionGrid
            columns={2}
            options={VIBE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              hint: o.hint,
              selected: wizard.travelStyle === o.value,
            }))}
            onSelect={(v) =>
              patch({
                travelStyle: v as TravelStyle,
              })
            }
          />
          <OptionalField
            label={
              wizard.travelStyle === "vfr"
                ? "Where are you visiting? (helps us pick the right airport)"
                : "Anything specific? (optional)"
            }
            value={wizard.vibeDescribe ?? ""}
            onChange={(v) => patch({ vibeDescribe: v })}
            placeholder={
              wizard.travelStyle === "vfr"
                ? "e.g. relatives in Bắc Giang, family in Hai Phong, cousins in Hanoi…"
                : "e.g. Vung Tau beaches, Hoi An old town, quiet beaches…"
            }
          />
        </div>
      );

    case "details":
      return (
        <DetailsStep wizard={wizard} patch={patch} />
      );

    default:
      return null;
  }
}

function DetailsStep({
  wizard,
  patch,
}: {
  wizard: TripWizardState;
  patch: (p: Partial<TripWizardState>) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(Boolean(wizard.showAdvanced));

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">When</p>
        <OptionGrid
          columns={1}
          options={DATE_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            hint: o.hint,
            selected: (wizard.dateFlexibility ?? "flexible_±3") === o.value,
          }))}
          onSelect={(v) =>
            patch({ dateFlexibility: v as TripWizardState["dateFlexibility"] })
          }
        />
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">
          Travellers
        </p>
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
      </section>

      <OptionalField
        label="Date notes (optional)"
        value={wizard.dateDescribe ?? ""}
        onChange={(v) => patch({ dateDescribe: v })}
        placeholder="e.g. Mid-November, school holidays…"
        rows={2}
      />

      <div className="rounded-3xl border border-line/70 bg-surface-2/40">
        <button
          type="button"
          onClick={() => {
            setShowAdvanced((v) => !v);
            patch({ showAdvanced: !showAdvanced });
          }}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink"
        >
          More options
          <span className="text-muted">{showAdvanced ? "−" : "+"}</span>
        </button>
        {showAdvanced ? (
          <div className="space-y-4 border-t border-line/60 px-4 py-4">
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">
                Budget
              </p>
              <OptionGrid
                columns={3}
                options={BUDGET_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                  hint: o.hint,
                  selected: wizard.budgetBand === o.value,
                }))}
                onSelect={(v) =>
                  patch({ budgetBand: v as TripWizardState["budgetBand"] })
                }
              />
            </section>
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">
                Priority
              </p>
              <OptionGrid
                columns={2}
                options={PRIORITY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                  selected: wizard.priority === o.value,
                }))}
                onSelect={(v) => patch({ priority: v as PriorityPreset })}
              />
            </section>
            <OptionalField
              label="Extra notes (optional)"
              value={wizard.extraNotes ?? ""}
              onChange={(v) => patch({ extraNotes: v })}
              placeholder="Accessibility, max connections, must-see places…"
              rows={2}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OptionalField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-2 focus:border-teal/40 focus:outline-none focus:ring-2 focus:ring-teal/10"
      />
    </div>
  );
}
