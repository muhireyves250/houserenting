import { describe, expect, it } from "vitest";
import { roomLabel } from "./links";
import { descriptionOfRoom, parseRoomNumbers, photosOfRoom, roomInput } from "./validation";

describe("room names in a room type", () => {
  it("splits on commas and new lines, keeping names with spaces, without repeats", () => {
    expect(parseRoomNumbers("101, 102,102\nLake Kivu; Muhabura ")).toEqual(["101", "102", "Lake Kivu", "Muhabura"]);
  });

  it("calls a number 'Room N' and a name by its name", () => {
    const numbered = (n: string) => `Room ${n}`;
    expect(roomLabel("12", numbered)).toBe("Room 12");
    expect(roomLabel("101B", numbered)).toBe("Room 101B");
    expect(roomLabel("Lake Kivu", numbered)).toBe("Lake Kivu");
  });
});

describe("each room's own photos and description", () => {
  const own = "https://res.cloudinary.com/demo/own.jpg";
  const type = "https://res.cloudinary.com/demo/type.jpg";
  const place = "https://res.cloudinary.com/demo/place.jpg";
  const base = { name: "First floor", description: "", maxGuests: 1, facilities: [] as never[], rates: [{ unit: "NIGHT" as const, price: 40000 }], numbers: ["101"] };

  it("shows the room's own photos, else its type's, else the place's", () => {
    const room = { photos: [type], description: "Type", unitDetails: { "101": { photos: [own], description: "" } } };
    expect(photosOfRoom(room, "101", [place])).toEqual([own]);
    expect(photosOfRoom(room, "102", [place])).toEqual([type]);
    expect(photosOfRoom({ photos: [], description: "", unitDetails: {} }, "102", [place])).toEqual([place]);
    expect(photosOfRoom({ photos: [], description: "", unitDetails: "broken" }, "101", [place])).toEqual([place]);
  });

  it("describes a room with its own words, else its type's", () => {
    const room = { photos: [], description: "Type words", unitDetails: { "101": { photos: [], description: "Corner room" } } };
    expect(descriptionOfRoom(room, "101")).toBe("Corner room");
    expect(descriptionOfRoom(room, "102")).toBe("Type words");
  });

  it("keeps details only for rooms that are in the type and have some", () => {
    const parsed = roomInput.parse({ ...base, unitDetails: { "101": { photos: [own], description: "" }, "999": { photos: [own], description: "x" }, "102": { photos: [], description: "" } } });
    expect(parsed.unitDetails).toEqual({ "101": { photos: [own], description: "" } });
  });

  it("refuses photos that are not ours", () => {
    expect(roomInput.safeParse({ ...base, unitDetails: { "101": { photos: ["https://evil.example/x.jpg"], description: "" } } }).success).toBe(false);
  });
});
