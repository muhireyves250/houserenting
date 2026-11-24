/** "Open 24 hours": check-in from midnight and check-out until the end of the day (any time). */
export const OPEN_FROM = "00:00";
export const OPEN_UNTIL = "23:59";
export const isOpen24h = (from: string | null | undefined, until: string | null | undefined) => from === OPEN_FROM && until === OPEN_UNTIL;
