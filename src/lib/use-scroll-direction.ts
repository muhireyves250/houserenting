"use client";

import { useEffect, useState } from "react";

export type ScrollState = { hidden: boolean; scrolled: boolean; lastY: number; settleUntil?: number };

// Keep chrome visible near the top, and ignore finger jitter smaller than this.
const SHOW_NEAR_TOP_PX = 80;
const JITTER_PX = 6;
// Hiding/showing changes the bar's height and the browser shifts the scroll position to match; ignore scroll
// changes until that settles, or the shift reads as a scroll the other way and the bar flickers.
const SETTLE_MS = 450;

/** Pure step: hide while scrolling down, show on any real scroll up or near the top. */
export function nextScrollState(state: ScrollState, y: number, now = 0): ScrollState {
  if (state.settleUntil && now < state.settleUntil) return { ...state, lastY: y, scrolled: y > 8 };
  const delta = y - state.lastY;
  if (Math.abs(delta) < JITTER_PX) return state;
  const hidden = y > SHOW_NEAR_TOP_PX && delta > 0;
  return { hidden, scrolled: y > 8, lastY: y, settleUntil: hidden !== state.hidden ? now + SETTLE_MS : undefined };
}

/** Whether to tuck away secondary chrome (scrolling down) and whether the page is scrolled at all. */
export function useScrollDirection(): { hidden: boolean; scrolled: boolean } {
  const [state, setState] = useState<ScrollState>({ hidden: false, scrolled: false, lastY: 0 });
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setState((current) => nextScrollState(current, window.scrollY, performance.now())));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return { hidden: state.hidden, scrolled: state.scrolled };
}
