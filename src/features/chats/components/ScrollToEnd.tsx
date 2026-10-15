"use client";

import { useEffect } from "react";

/** Keeps the newest message in view when the chat opens or a message arrives. */
export function ScrollToEnd({ count }: { count: number }) {
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight });
  }, [count]);
  return null;
}
