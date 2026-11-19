"use client";

import { useEffect } from "react";

/** Keeps the newest message in view when the chat opens or a message arrives (in a box with `targetId`, or the page). */
export function ScrollToEnd({ count, targetId }: { count: number; targetId?: string }) {
  useEffect(() => {
    const box = targetId ? document.getElementById(targetId) : null;
    // The box when it scrolls by itself (computers), otherwise the page (phones).
    if (box && getComputedStyle(box).overflowY !== "visible") box.scrollTop = box.scrollHeight;
    else window.scrollTo({ top: document.body.scrollHeight });
  }, [count, targetId]);
  return null;
}
