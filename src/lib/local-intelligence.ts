// =============================================================================
// Local & Seasonal Intelligence (Sections 4.7 & 4.8)
// Barasat Delivery Zones, Monsoon Mode, Bengali Calendar, Licence Renewals
// =============================================================================

import { DeliveryZone, MonsoonModeConfig, LicenceReminder } from "./types";

// -----------------------------------------------------------------------------
// Barasat - Madhyamgram - Kolkata Delivery Zone Bands
// -----------------------------------------------------------------------------
export const BARASAT_DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "ZONE_BARASAT_CHAMPADALI",
    name: "Barasat Town & Champadali (Local)",
    bengali_name: "বারাসাত শহর ও চাঁপাডালি মোড়",
    default_charge: 500,
    standard_crew_size: 2,
    lead_time_days: 1,
  },
  {
    id: "ZONE_MADHYAMGRAM",
    name: "Madhyamgram & Sodepur Road",
    bengali_name: "মধ্যমগ্রাম ও সোদপুর রোড",
    default_charge: 750,
    standard_crew_size: 2,
    lead_time_days: 1,
  },
  {
    id: "ZONE_NEW_BARRACKPORE",
    name: "New Barrackpore & Michael Nagar",
    bengali_name: "নিউ ব্যারাকপুর ও মাইকেল নগর",
    default_charge: 850,
    standard_crew_size: 2,
    lead_time_days: 2,
  },
  {
    id: "ZONE_DUTTAPUKUR",
    name: "Duttapukur & Bamangachi",
    bengali_name: "দত্তপুকুর ও বামনগাছি",
    default_charge: 800,
    standard_crew_size: 2,
    lead_time_days: 2,
  },
  {
    id: "ZONE_HABRA_ASHOKNAGAR",
    name: "Ashoknagar - Habra Belt",
    bengali_name: "অশোকনগর - হাবড়া বেল্ট",
    default_charge: 1200,
    standard_crew_size: 2,
    lead_time_days: 2,
  },
  {
    id: "ZONE_BARRACKPORE",
    name: "Barrackpore & Titagarh",
    bengali_name: "ব্যারাকপুর ও টিটাগড়",
    default_charge: 1100,
    standard_crew_size: 2,
    lead_time_days: 2,
  },
  {
    id: "ZONE_RAJARHAT_NEWTOWN",
    name: "Rajarhat - New Town Action Areas",
    bengali_name: "রাজারহাট - নিউ টাউন অ্যাকশন এরিয়া",
    default_charge: 1400,
    standard_crew_size: 3,
    lead_time_days: 2,
  },
  {
    id: "ZONE_SALT_LAKE",
    name: "Salt Lake (Sector 1 to 5)",
    bengali_name: "সল্টলেক (সেক্টর ১ থেকে ৫)",
    default_charge: 1600,
    standard_crew_size: 3,
    lead_time_days: 3,
  },
  {
    id: "ZONE_CENTRAL_KOLKATA",
    name: "Central & South Kolkata",
    bengali_name: "সেন্ট্রাল ও দক্ষিণ কলকাতা",
    default_charge: 2000,
    standard_crew_size: 3,
    lead_time_days: 3,
  },
  {
    id: "ZONE_OUTSIDE_BELT",
    name: "Outside Greater Kolkata Belt",
    bengali_name: "গ্রেটার কলকাতার বাইরে",
    default_charge: 3500,
    standard_crew_size: 4,
    lead_time_days: 5,
  },
];

/**
 * Calculates delivery surcharge based on floor height when building lacks a service lift.
 */
export function calculateDeliveryAndFloorSurcharge(params: {
  zoneId: string;
  floorLevel: number; // 0 = Ground floor
  hasLift: boolean;
}): {
  zone: DeliveryZone;
  baseDeliveryCharge: number;
  floorSurcharge: number;
  totalDeliveryCharge: number;
} {
  const zone =
    BARASAT_DELIVERY_ZONES.find((z) => z.id === params.zoneId) ||
    BARASAT_DELIVERY_ZONES[0];

  let floorSurcharge = 0;
  // If 2nd floor or higher and no lift, manual carrying surcharge of ₹250 per floor per sofa piece
  if (params.floorLevel >= 2 && !params.hasLift) {
    floorSurcharge = (params.floorLevel - 1) * 250;
  }

  return {
    zone,
    baseDeliveryCharge: zone.default_charge,
    floorSurcharge,
    totalDeliveryCharge: zone.default_charge + floorSurcharge,
  };
}

// -----------------------------------------------------------------------------
// Monsoon Mode Controller
// -----------------------------------------------------------------------------
export let activeMonsoonConfig: MonsoonModeConfig = {
  is_active: false,
  humidity_pct: 68,
  timber_moisture_max_threshold: 12.0, // Normal threshold: max 12% moisture
  polish_curing_extra_hours: 0,
  adhesive_curing_extra_hours: 0,
};

export function toggleMonsoonMode(enable: boolean): MonsoonModeConfig {
  if (enable) {
    activeMonsoonConfig = {
      is_active: true,
      humidity_pct: 88, // Typical monsoon humidity in West Bengal
      timber_moisture_max_threshold: 15.0, // Raised moisture quarantine check
      polish_curing_extra_hours: 24, // Extra 24 hrs curing needed to prevent polish blooming
      adhesive_curing_extra_hours: 12,
    };
  } else {
    activeMonsoonConfig = {
      is_active: false,
      humidity_pct: 65,
      timber_moisture_max_threshold: 12.0,
      polish_curing_extra_hours: 0,
      adhesive_curing_extra_hours: 0,
    };
  }
  return { ...activeMonsoonConfig };
}

export function getMonsoonConfig(): MonsoonModeConfig {
  return { ...activeMonsoonConfig };
}

// -----------------------------------------------------------------------------
// Statutory Municipal & Fire Licence Reminders
// -----------------------------------------------------------------------------
export const MUNICIPAL_LICENCE_REMINDERS: LicenceReminder[] = [
  {
    id: "LIC_BARASAT_TRADE",
    licence_name: "Barasat Municipality Trade Licence (পৌরসভা ট্রেড লাইসেন্স)",
    issuing_authority: "Barasat Municipality, Ward 12",
    expiry_date: "2027-03-31",
    days_remaining: 201,
    status: "VALID",
  },
  {
    id: "LIC_WB_SHOPS_EST",
    licence_name: "West Bengal Shops & Establishments Registration",
    issuing_authority: "Labour Department, Govt of West Bengal",
    expiry_date: "2026-12-31",
    days_remaining: 110,
    status: "VALID",
  },
  {
    id: "LIC_FIRE_NOC",
    licence_name: "West Bengal Fire & Emergency Services NOC (Wood Workshop)",
    issuing_authority: "WBFES Barasat Fire Station",
    expiry_date: "2026-10-15",
    days_remaining: 33,
    status: "RENEWAL_DUE",
  },
  {
    id: "LIC_MSME_UDYAM",
    licence_name: "Udyam MSME Registration Certificate",
    issuing_authority: "Ministry of MSME, Govt of India",
    expiry_date: "Permanent (No Expiry)",
    days_remaining: 9999,
    status: "VALID",
  },
];
