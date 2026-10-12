import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import rw from "../../messages/rw.json";
import type { AppLocale } from "./routing";

export type Messages = typeof en;

export const catalogs: Record<AppLocale, Messages> = { en, rw, fr };
