"use client";

import { useEffect } from "react";

/** Keeps the newest message in view when the chat opens or a message arrives (in a box with `targetId`, or the page). */
export function ScrollToEnd({ count, targetId }: { count: number; targetId?: string }) {
  useEffect(() => {
    const box = targetId ? document.getElementById(targetId) : null;
    if (box) box.scrollTop = box.scrollHeight;
    else window.scrollTo({ top: document.body.scrollHeight });
  }, [count, targetId]);
  return null;
}
