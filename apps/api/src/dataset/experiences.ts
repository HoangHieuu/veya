import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DestinationCity, ExperienceHighlight } from "../../../../shared/types.js";
import { z } from "zod";

const EXPERIENCES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data/experiences",
);

const highlightSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  transferNote: z.string().min(1),
  imageUrl: z.string().min(1),
  tags: z.array(z.enum(["food", "beach", "quiet", "family", "culture", "city"])).min(1),
  featured: z.boolean().optional(),
});

const gatewayPackSchema = z.object({
  gateway: z.enum(["HAN", "SGN", "DAD"]),
  gatewayLabel: z.string().min(1),
  highlights: z.array(highlightSchema).min(1),
});

export type GatewayExperiencePack = z.infer<typeof gatewayPackSchema>;

let cache: Map<DestinationCity, ExperienceHighlight[]> | null = null;

export function loadExperienceHighlights(
  gateway: DestinationCity,
  root = EXPERIENCES_ROOT,
): ExperienceHighlight[] {
  const map = loadAllExperiencePacks(root);
  return structuredClone(map.get(gateway) ?? []);
}

function loadAllExperiencePacks(root: string): Map<DestinationCity, ExperienceHighlight[]> {
  if (cache && root === EXPERIENCES_ROOT) {
    return cache;
  }

  const map = new Map<DestinationCity, ExperienceHighlight[]>();
  if (!existsSync(root)) {
    cache = map;
    return map;
  }

  for (const file of readdirSync(root).filter((name) => name.endsWith(".json")).sort()) {
    try {
      const raw: unknown = JSON.parse(readFileSync(path.join(root, file), "utf8"));
      const parsed = gatewayPackSchema.safeParse(raw);
      if (!parsed.success) continue;
      map.set(parsed.data.gateway, parsed.data.highlights);
    } catch {
      /* skip invalid file */
    }
  }

  if (root === EXPERIENCES_ROOT) {
    cache = map;
  }
  return map;
}

export function resetExperienceCacheForTests() {
  cache = null;
}
