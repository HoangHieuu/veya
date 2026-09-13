import type { OriginCity, DestinationCity } from "@shared/types";

/** Illustrative AUD one-way from published VNA AU route pages — demo only */
const FARE_TABLE: Record<OriginCity, Record<DestinationCity, number>> = {
  SYD: { HAN: 1240, SGN: 1180, DAD: 1050 },
  MEL: { HAN: 1120, SGN: 1090, DAD: 980 },
  PER: { HAN: 1150, SGN: 920, DAD: 1010 },
};

export function illustrativeFareAud(
  origin: OriginCity,
  destination: DestinationCity,
): number {
  return FARE_TABLE[origin]?.[destination] ?? 1100;
}
