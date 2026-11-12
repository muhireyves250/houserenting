/** The address of the one room of a room type that has no room numbers: /listings/…/rooms/<type>/room. */
export const ONLY_ROOM = "room";

/** How a room is called: "Room 12" for a number (12, 101B), or its own name ("Lake Kivu"). */
export function roomLabel(name: string, numbered: (number: string) => string): string {
  return /^\d+[A-Za-z]?$/.test(name) ? numbered(name) : name;
}
