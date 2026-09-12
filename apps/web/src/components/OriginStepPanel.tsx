import type { ReactNode } from "react";
import type { OriginCity } from "@shared/types";
import { OriginGlobe } from "./OriginGlobe";

export function OriginStepPanel({
  origin,
  children,
}: {
  origin: OriginCity;
  children: ReactNode;
}) {
  return (
    <div className="origin-step-panel overflow-hidden rounded-2xl">
      <div className="origin-globe-band">
        <div className="origin-globe-layer">
          <OriginGlobe origin={origin} className="anim-globe-in" />
        </div>
        <div className="origin-step-fade" aria-hidden />
      </div>

      <div className="relative z-10 px-1 pb-1 pt-2">{children}</div>
    </div>
  );
}
