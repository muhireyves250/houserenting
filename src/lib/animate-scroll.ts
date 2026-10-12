/** Slow start, glide, soft landing. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Longer trips take a little longer, within a relaxed 900–1600ms. */
export function scrollDuration(distance: number): number {
  return Math.round(Math.min(1600, Math.max(900, 700 + Math.abs(distance) * 0.6)));
}

const USER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "mousedown"] as const;

/**
 * Eased window scroll to `top`. Resolves when it arrives, or early if the user takes over
 * (wheel, touch, key, click). Instant when the user prefers reduced motion.
 */
export function animateScrollTo(top: number): Promise<void> {
  const start = window.scrollY;
  const distance = top - start;
  if (distance === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, top);
    return Promise.resolve();
  }

  const duration = scrollDuration(distance);
  return new Promise((resolve) => {
    let frame = 0;
    const began = performance.now();

    const finish = () => {
      cancelAnimationFrame(frame);
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, finish);
      resolve();
    };
    for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, finish, { passive: true, once: true });

    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / duration);
      window.scrollTo(0, Math.round(start + distance * easeInOutCubic(progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
      else finish();
    };
    frame = requestAnimationFrame(step);
  });
}
