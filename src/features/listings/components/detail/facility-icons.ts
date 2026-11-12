import { AirVent, CookingPot, Laptop, type LucideIcon, Microwave, ShieldCheck, ShowerHead, SquareParking, Tv, Utensils, WashingMachine, WavesLadder, Wifi, Zap } from "lucide-react";

/** The icon shown beside each facility on a place's (or room's) page. */
export const FACILITY_ICONS: Record<string, LucideIcon> = {
  KITCHEN: CookingPot,
  WIFI: Wifi,
  AIR_CONDITIONER: AirVent,
  WORKPLACE: Laptop,
  WASHING_MACHINE: WashingMachine,
  DISHWASHER: Utensils,
  OVEN: CookingPot,
  MICROWAVE: Microwave,
  PARKING: SquareParking,
  TV: Tv,
  HOT_WATER: ShowerHead,
  SECURITY: ShieldCheck,
  GENERATOR: Zap,
  POOL: WavesLadder,
};
