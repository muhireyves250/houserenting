"use client";

import "lenis/dist/lenis.css";
import Lenis from "lenis";
import { useEffect } from "react";

// Areas that scroll or zoom on their own: dialogs (photo viewer, menus), maps, and anything opted out.
const OWN_SCROLL = '[role="dialog"], [role="listbox"], .maplibregl-map, [data-lenis-prevent]';

/**
 * Eased, inertial wheel scrolling (Lenis) on mouse/trackpad devices. Native scrolling stays on touch
 * screens and for people who prefer reduced motion. Pauses while a dialog locks the page.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches) return;

    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      autoRaf: true,
      anchors: true,
      prevent: (node) => Boolean(node.closest?.(OWN_SCROLL)),
    });

    // useModal locks scrolling with body overflow: hidden; follow it.
    const sync = () => (document.body.style.overflow === "hidden" ? lenis.stop() : lenis.start());
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    return () => {
      observer.disconnect();
      lenis.destroy();
    };
  }, []);

  return null;
}
