"use client";

import { Building2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PersonPicker } from "@/features/admin/components/PersonPicker";
import { EMPTY_LISTING, ListingForm } from "@/features/hosting/components/ListingForm";
import { cn } from "@/lib/cn";

/** Staff choose who the place is for (an owner's account, or VIIPA operates it), then fill in the usual form. */
export function AdminNewListing() {
  const t = useTranslations("Places");
  const [who, setWho] = useState<"viipa" | "owner">("viipa");
  const [owner, setOwner] = useState<{ id: string; name: string } | null>(null);
  const ready = who === "viipa" || owner;

  const option = (value: "viipa" | "owner", icon: React.ReactNode, title: string, body: string) => (
    <button
      type="button"
      aria-pressed={who === value}
      onClick={() => {
        setWho(value);
        setOwner(null);
      }}
      className={cn(
        "flex flex-1 items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
        who === value ? "border-primary bg-primary/[0.06]" : "border-line bg-surface hover:border-primary/60",
      )}
    >
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="block text-[13px] text-muted">{body}</span>
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        {option("viipa", <Building2 className="size-5" aria-hidden="true" />, t("forViipa"), t("forViipaBody"))}
        {option("owner", <UserRound className="size-5" aria-hidden="true" />, t("forOwner"), t("forOwnerBody"))}
      </div>
      {who === "owner" && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {/* Search the owner by name, email or phone; open their account here if they have none. */}
          <PersonPicker label={t("ownerEmail")} onPick={(p) => setOwner(p ? { id: p.id, name: p.name } : null)} />
        </div>
      )}
      {ready && <ListingForm key={owner?.id ?? "viipa"} listingId={null} initial={EMPTY_LISTING} live={false} staff={{ ownerId: owner?.id ?? null }} />}
    </div>
  );
}
