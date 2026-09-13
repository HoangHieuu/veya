import type { DestinationCity } from "@shared/types";



/** WGS84 — illustrative gateway / locality pins for map viz */

export interface GeoPoint {

  lat: number;

  lng: number;

  label: string;

  sublabel?: string;

}



export const GATEWAY_GEO: Record<DestinationCity, GeoPoint> = {

  SGN: {

    lat: 10.8188,

    lng: 106.652,

    label: "SGN",

    sublabel: "Tan Son Nhat · Vietnam Airlines gateway",

  },

  HAN: {

    lat: 21.2212,

    lng: 105.8019,

    label: "HAN",

    sublabel: "Noi Bai · gateway",

  },

  DAD: {

    lat: 16.0439,

    lng: 108.199,

    label: "DAD",

    sublabel: "Da Nang · gateway",

  },

};



/** Locality id (slug) → coordinates */

export const LOCALITY_GEO: Record<string, GeoPoint> = {

  "ca-mau": {

    lat: 9.1773,

    lng: 105.1524,

    label: "Cà Mau",

    sublabel: "Your visit — onward from SGN",

  },

  "ca mau": {

    lat: 9.1773,

    lng: 105.1524,

    label: "Cà Mau",

    sublabel: "Your visit — onward from SGN",

  },

  hanoi: {

    lat: 21.0285,

    lng: 105.8542,

    label: "Hanoi",

    sublabel: "Old Quarter & northern Vietnam",

  },

  saigon: {

    lat: 10.7769,

    lng: 106.7009,

    label: "Saigon",

    sublabel: "Districts & street food",

  },

  "ho-chi-minh-city": {

    lat: 10.7769,

    lng: 106.7009,

    label: "Ho Chi Minh City",

    sublabel: "Southern Vietnam hub",

  },

  "vung-tau": {

    lat: 10.346,

    lng: 107.084,

    label: "Vung Tau",

    sublabel: "Coastal visit — onward from SGN",

  },

  "vung tau": {

    lat: 10.346,

    lng: 107.084,

    label: "Vung Tau",

    sublabel: "Coastal visit — onward from SGN",

  },

  "da-nang": {

    lat: 16.0544,

    lng: 108.2022,

    label: "Da Nang",

    sublabel: "Central coast",

  },

  danang: {

    lat: 16.0544,

    lng: 108.2022,

    label: "Da Nang",

    sublabel: "Central coast",

  },

  "nha-trang": {

    lat: 12.2388,

    lng: 109.1967,

    label: "Nha Trang",

    sublabel: "Central coast · onward from Da Nang gateway",

  },

  "nha trang": {

    lat: 12.2388,

    lng: 109.1967,

    label: "Nha Trang",

    sublabel: "Central coast · onward from Da Nang gateway",

  },

  "phu-quoc": {

    lat: 10.227,

    lng: 103.9672,

    label: "Phu Quoc",

    sublabel: "Island · connect from SGN",

  },

  "phu quoc": {

    lat: 10.227,

    lng: 103.9672,

    label: "Phu Quoc",

    sublabel: "Island · connect from SGN",

  },

};



function matchesGatewayCity(title: string, gateway: DestinationCity): boolean {

  const t = title.toLowerCase();

  if (gateway === "HAN") return /\bhanoi\b|\bha noi\b|\bnoi bai\b/.test(t);

  if (gateway === "SGN") {

    return /\bsaigon\b|\bho chi minh\b|\bsgn\b|\btan son nhat\b/.test(t);

  }

  if (gateway === "DAD") return /\bda nang\b|\bdanang\b|\bđà nẵng\b/.test(t);

  return false;

}



export function resolveLocalityGeo(

  localityId: string,

  title: string,

  gateway?: DestinationCity,

): GeoPoint {

  const keys = [localityId, localityId.toLowerCase(), title.toLowerCase()];

  for (const key of keys) {

    if (LOCALITY_GEO[key]) return { ...LOCALITY_GEO[key], label: title || LOCALITY_GEO[key].label };

  }



  if (gateway && matchesGatewayCity(title, gateway)) {

    const gw = GATEWAY_GEO[gateway];

    return { lat: gw.lat, lng: gw.lng, label: title, sublabel: "Your destination" };

  }



  if (gateway) {

    const gw = GATEWAY_GEO[gateway];

    return { lat: gw.lat, lng: gw.lng, label: title, sublabel: "Near gateway — illustrative pin" };

  }



  return {

    lat: 9.1773,

    lng: 105.1524,

    label: title,

    sublabel: "Destination in Vietnam",

  };

}



export function isSameHub(gateway: GeoPoint, locality: GeoPoint): boolean {

  const dLat = gateway.lat - locality.lat;

  const dLng = gateway.lng - locality.lng;

  return Math.hypot(dLat, dLng) < 0.35;

}



export function isIslandLocality(localityId: string, title?: string): boolean {
  const id = localityId.toLowerCase();
  const t = (title ?? "").toLowerCase();
  return id === "phu-quoc" || id === "phu quoc" || /\bphu quoc\b/.test(t);
}

export function buildFallbackRoute(
  gateway: GeoPoint,
  locality: GeoPoint,
  localityId: string,
): [number, number][] {
  const id = localityId.toLowerCase();
  if (id === "ca-mau" || id === "ca mau") {
    return SGN_TO_CA_MAU_ROUTE;
  }
  return [
    [gateway.lat, gateway.lng],
    [locality.lat, locality.lng],
  ];
}

/** Approximate road path SGN → Cà Mau (fallback if OSRM unavailable) */

export const SGN_TO_CA_MAU_ROUTE: [number, number][] = [

  [10.8188, 106.652],

  [10.62, 106.52],

  [10.35, 106.12],

  [10.045, 105.785],

  [9.55, 105.35],

  [9.1773, 105.1524],

];

