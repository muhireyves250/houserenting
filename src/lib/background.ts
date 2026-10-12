import { after } from "next/server";

/**
 * Keeps a task alive after the response is sent (serverless hosts may otherwise freeze it).
 * Outside a request scope (scripts, tests) `after` throws, so the task just runs fire-and-forget.
 */
export function runInBackground(task: Promise<unknown>): void {
  try {
    after(task);
  } catch {
    void task;
  }
}
