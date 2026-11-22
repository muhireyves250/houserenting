"use client";

import { PersonPicker } from "./PersonPicker";

/**
 * Who to add to a team. VIIPA staff search every active account (name, email or phone) and can open one; owners
 * type the person's exact email, so they never browse other people's accounts.
 */
export function MemberField({ staff, value, onChange, label, resetKey }: { staff: boolean; value: string; onChange: (email: string) => void; label: string; resetKey: number }) {
  if (staff)
    return (
      <div className="min-w-0 flex-1">
        <PersonPicker key={resetKey} label={label} onChange={onChange} />
      </div>
    );
  return (
    <input
      type="email"
      required
      value={value}
      placeholder={label}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] outline-none focus:border-primary"
    />
  );
}
