import { describe, expect, it } from "vitest";
import { roomLabel } from "./links";
import { parseRoomNumbers } from "./validation";

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
