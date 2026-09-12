import clsx from "clsx";
import { useState } from "react";
import type { OriginCity } from "@shared/types";
import { useGlobeTuning } from "../context/GlobeTuningContext";
import { globeTuningSnippet } from "../lib/globeTuning";

const ORIGINS: OriginCity[] = ["SYD", "MEL", "PER"];

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="globe-tune-row">
      <span className="globe-tune-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="globe-tune-range"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="globe-tune-num"
      />
    </label>
  );
}

export function GlobeTuningPanel() {
  const { tuning, setTuning, resetTuning } = useGlobeTuning();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    const text = globeTuningSnippet(tuning);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={clsx("globe-tune-panel", !open && "globe-tune-panel-collapsed")}>
      <button
        type="button"
        className="globe-tune-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        Globe tune {open ? "▾" : "▸"}
      </button>

      {open ? (
        <div className="globe-tune-body">
          <label className="globe-tune-check">
            <input
              type="checkbox"
              checked={tuning.manual}
              onChange={(e) => setTuning({ manual: e.target.checked })}
            />
            Manual φ / θ (ignore city)
          </label>

          {tuning.manual ? (
            <>
              <SliderRow
                label="φ manual"
                value={tuning.manualPhi}
                min={0}
                max={6.29}
                step={0.01}
                onChange={(manualPhi) => setTuning({ manualPhi })}
              />
              <SliderRow
                label="θ manual"
                value={tuning.manualTheta}
                min={-0.5}
                max={1.5}
                step={0.01}
                onChange={(manualTheta) => setTuning({ manualTheta })}
              />
            </>
          ) : (
            <>
              <SliderRow
                label="AU_BASE φ"
                value={tuning.auPhi}
                min={0}
                max={6.29}
                step={0.01}
                onChange={(auPhi) => setTuning({ auPhi })}
              />
              <SliderRow
                label="AU_BASE θ"
                value={tuning.auTheta}
                min={-0.5}
                max={1.5}
                step={0.01}
                onChange={(auTheta) => setTuning({ auTheta })}
              />
              <SliderRow
                label="lat factor"
                value={tuning.latFactor}
                min={0}
                max={1}
                step={0.01}
                onChange={(latFactor) => setTuning({ latFactor })}
              />

              <label className="globe-tune-check">
                <input
                  type="checkbox"
                  checked={tuning.usePreviewOrigin}
                  onChange={(e) => setTuning({ usePreviewOrigin: e.target.checked })}
                />
                Preview city
              </label>
              {tuning.usePreviewOrigin ? (
                <div className="globe-tune-cities">
                  {ORIGINS.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={clsx(
                        "globe-tune-city",
                        tuning.previewOrigin === code && "globe-tune-city-active",
                      )}
                      onClick={() => setTuning({ previewOrigin: code })}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}

          <SliderRow
            label="scale"
            value={tuning.scale}
            min={0.5}
            max={2}
            step={0.01}
            onChange={(scale) => setTuning({ scale })}
          />
          <SliderRow
            label="offset X"
            value={tuning.offsetX}
            min={-40}
            max={40}
            step={0.5}
            onChange={(offsetX) => setTuning({ offsetX })}
          />
          <SliderRow
            label="offset Y"
            value={tuning.offsetY}
            min={-40}
            max={40}
            step={0.5}
            onChange={(offsetY) => setTuning({ offsetY })}
          />

          <pre className="globe-tune-snippet">{globeTuningSnippet(tuning)}</pre>

          <div className="globe-tune-actions">
            <button type="button" className="globe-tune-btn" onClick={() => void copySnippet()}>
              {copied ? "Copied" : "Copy values"}
            </button>
            <button type="button" className="globe-tune-btn globe-tune-btn-muted" onClick={resetTuning}>
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
