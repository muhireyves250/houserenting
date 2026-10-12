"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = { value: T; label: string };

const MOTION = "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none";

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Option under the mouse; the hover shade slides to it and stays put when the mouse leaves.
  const [hovered, setHovered] = useState<number | null>(null);
  const [hoverAt, setHoverAt] = useState(0);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const pill = (index: number) => ({ width: `${100 / options.length}%`, transform: `translateX(${index * 100}%)` });

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex w-full rounded-full bg-surface p-1", className)}>
      <div className="relative grid flex-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} onMouseLeave={() => setHovered(null)}>
        <span
          data-testid="tabs-hover"
          data-visible={hovered !== null}
          aria-hidden="true"
          style={pill(hoverAt)}
          className={cn("pointer-events-none absolute inset-y-0 left-0 rounded-full bg-ink/10", MOTION, hovered !== null ? "opacity-100" : "opacity-0")}
        />
        <span
          data-testid="tabs-selected"
          aria-hidden="true"
          style={pill(selectedIndex)}
          className={cn("pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary", MOTION)}
        />
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onMouseEnter={() => {
                setHovered(index);
                setHoverAt(index);
              }}
              className={cn(
                "relative z-10 rounded-full px-4 py-2 text-sm transition-colors duration-500",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                selected ? "text-white" : "text-ink",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
