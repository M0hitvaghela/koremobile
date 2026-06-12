import gujaratJson from '../data/gujarat.json';

// Structure: District -> Taluka -> Pincode[]
type GujaratData = Record<string, Record<string, string[]>>;
const data = gujaratJson as GujaratData;

export const getDistricts = (): string[] => Object.keys(data).sort();

export const getTalukas = (district: string): string[] => {
  if (!district || !data[district]) return [];
  return Object.keys(data[district]).sort();
};

export const getPincodes = (district: string, taluka: string): string[] => {
  if (!district || !taluka || !data[district]?.[taluka]) return [];
  return data[district][taluka];
};

export interface PincodeMatch {
  district: string;
  taluka: string;
  pincode: string;
}

/** Look up all district+taluka combos that contain this pincode */
export const lookupByPincode = (pincode: string): PincodeMatch[] => {
  const results: PincodeMatch[] = [];
  for (const district of Object.keys(data)) {
    for (const taluka of Object.keys(data[district])) {
      if (data[district][taluka].includes(pincode)) {
        results.push({ district, taluka, pincode });
      }
    }
  }
  return results;
};

/** Returns true if pincode exists anywhere in Gujarat data */
export const isValidGujarat = (pincode: string): boolean =>
  lookupByPincode(pincode).length > 0;

/** Returns true if pincode starts with Gujarat prefixes (36-39) */
export const isGujaratPincode = (pincode: string): boolean =>
  /^3[6-9]\d{4}$/.test(pincode);

// ── Delivery cache — stores full serviceability info from API ─────────────────
export interface DeliveryInfo {
  deliverable: boolean;
  cod: boolean;
  prepaid: boolean;
}

const deliveryCache = new Map<string, DeliveryInfo>();
const cityCache     = new Map<string, string>();  // pincode -> "RAJKOT, gujarat"

export const getDeliveryCache = (pincode: string): DeliveryInfo | undefined =>
  deliveryCache.get(pincode);

export const setDeliveryCache = (pincode: string, info: DeliveryInfo): void => {
  deliveryCache.set(pincode, info);
};

export const getCityCache = (pincode: string): string | undefined =>
  cityCache.get(pincode);

export const setCityCache = (pincode: string, city: string): void => {
  cityCache.set(pincode, city);
};