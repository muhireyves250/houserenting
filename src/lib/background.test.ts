// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const after = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after }));

import { runInBackground } from "./background";

describe("runInBackground", () => {
  afterEach(() => after.mockReset());

  it("hands the task to Next's after() so serverless hosts keep it alive", () => {
    const task = Promise.resolve();
    runInBackground(task);
    expect(after).toHaveBeenCalledWith(task);
  });

  it("falls back to fire-and-forget outside a request (scripts, tests)", () => {
    after.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });
    expect(() => runInBackground(Promise.resolve())).not.toThrow();
  });
});
