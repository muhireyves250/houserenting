/** Kept outside the server-only service so forms can list them. */
export const TICKET_CATEGORIES_LIST = ["QUESTION", "BOOKING", "PAYMENT", "COMPLAINT", "OTHER"] as const;
export type Category = (typeof TICKET_CATEGORIES_LIST)[number];
