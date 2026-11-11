"use client";

import { useEffect, useState } from "react";

/**
 * Types each word, waits, deletes it and moves to the next, for a "live" search hint. Returns "" until it starts,
 * and nothing moves for people who prefer reduced motion (the first word is shown as is).
 */
export function useTypewriter(words: string[], enabled = true): string {
  const [text, setText] = useState("");
  const key = words.join("|");
  useEffect(() => {
    if (!enabled || words.length === 0) return;
    if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => setText(words[0]!));
      return;
    }
    let word = 0;
    let chars = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = words[word]!;
      if (!deleting) {
        chars += 1;
        setText(current.slice(0, chars));
        if (chars === current.length) {
          deleting = true;
          timer = setTimeout(tick, 1600);
          return;
        }
        timer = setTimeout(tick, 75);
      } else {
        chars -= 1;
        setText(current.slice(0, chars));
        if (chars === 0) {
          deleting = false;
          word = (word + 1) % words.length;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 35);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
    // `key` stands for the words.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return text;
}
