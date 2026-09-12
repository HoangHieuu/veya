import type {
  BudgetBand,
  DestinationCity,
  OriginCity,
  PriorityPreset,
  TravelStyle,
} from "../../../../shared/types.js";

export const ORIGIN_LEXICON: ReadonlyArray<{
  pattern: RegExp;
  city: OriginCity;
}> = [
  { pattern: /\bSYD\b|\bSydney\b/i, city: "SYD" },
  { pattern: /\bMEL\b|\bMelbourne\b/i, city: "MEL" },
  { pattern: /\bPER\b|\bPerth\b/i, city: "PER" },
];

export const DESTINATION_LEXICON: ReadonlyArray<{
  pattern: RegExp;
  city: DestinationCity;
}> = [
  {
    pattern: /\bHAN\b|\bHa\s*Noi\b|\bHanoi\b|\bHa\s*Long\b|\bNinh\s*Binh\b/i,
    city: "HAN",
  },
  {
    pattern:
      /\bSGN\b|\bSaigon\b|\bHo\s*Chi\s*Minh\b|\bHCMC\b|\bVung\s*Tau\b|\bCu\s*Chi\b/i,
    city: "SGN",
  },
  {
    pattern:
      /\bDAD\b|\bDa\s*Nang\b|\bDanang\b|\bHoi\s*An\b|\bHội\s*An\b|\bMy\s*Khe\b|\bMarble\s*Mountains?\b/i,
    city: "DAD",
  },
];

export const STYLE_LEXICON: ReadonlyArray<{
  pattern: RegExp;
  style: TravelStyle;
}> = [
  {
    pattern: /\bbeach(?:es)?\b|\brelax(?:ation)?\b|\bseaside\b/i,
    style: "beach_relaxation",
  },
  {
    pattern:
      /\bfood\b|\bstreet\s*food\b|\bcooking\b|\bfood\s*(?:and|&)\s*culture\b/i,
    style: "food_culture",
  },
  {
    pattern: /\beducation\b|\bstudy\b|\bstudent\b|\buniversity\b/i,
    style: "education",
  },
  { pattern: /\bfamily\b|\bkids?\b|\bchildren\b/i, style: "family" },
  {
    pattern: /\bVFR\b|\bvisit(?:ing)?\s+family\b|\brelatives?\b/i,
    style: "vfr",
  },
  { pattern: /\bmixed\b|\bbit\s+of\s+everything\b/i, style: "mixed" },
];

export const BUDGET_LEXICON: ReadonlyArray<{
  pattern: RegExp;
  band: BudgetBand;
}> = [
  { pattern: /budget\s*band:\s*budget\b/i, band: "budget" },
  { pattern: /budget\s*band:\s*standard\b/i, band: "standard" },
  { pattern: /budget\s*band:\s*premium\b/i, band: "premium" },
  { pattern: /\bpremium\b|\bluxury\b|\bfirst\s*class\b/i, band: "premium" },
  { pattern: /\bstandard\b|\bmid[- ]?range\b/i, band: "standard" },
  { pattern: /\bbudget\b(?!\s*band)|\bcheap\b|\blow[- ]cost\b/i, band: "budget" },
];

export const PRIORITY_LEXICON: ReadonlyArray<{
  pattern: RegExp;
  priority: PriorityPreset;
}> = [
  {
    pattern: /\blowest\s+hassle\b|\bfew\s+connections?\b|\blow\s+hassle\b/i,
    priority: "lowest_hassle",
  },
  {
    pattern: /\bbest\s+for\s+family\b|\bfamily[- ]friendly\b/i,
    priority: "best_for_family",
  },
  {
    pattern: /\bmaximi[sz]e\s+miles\b|\blotusmiles\b/i,
    priority: "maximise_miles",
  },
  {
    pattern: /\bfood\s*(?:and|&)\s*culture\b|\bculture\s+first\b/i,
    priority: "food_and_culture",
  },
];

export const DIRECT_ONLY_PATTERN =
  /\bdirect\s+only\b|\bnon[- ]?stop(?:s)?\s+only\b|\bnonstop\s+only\b/i;

export const FEW_STOPS_PATTERN =
  /\bfew\s+connections?\b|\bone\s+stop\b|\b1\s+stop\b/i;
