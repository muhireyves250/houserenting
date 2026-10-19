"use client";

import { Building2, Search, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { EMPTY_LISTING, ListingForm } from "@/features/hosting/components/ListingForm";
import { cn } from "@/lib/cn";
import { findOwnerAction } from "../actions";

/** Staff choose who the place is for (an owner's account, or VIIPA operates it), then fill in the usual form. */
export function AdminNewListing() {
  const t = useTranslations("Places");
  const [who, setWho] = useState<"viipa" | "owner">("viipa");
  const [email, setEmail] = useState("");
  const [owner, setOwner] = useState<{ id: string; name: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pending, start] = useTransition();
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
        <form
          className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const found = await findOwnerAction(email);
              setOwner(found);
              setNotFound(!found);
            });
          }}
        >
          <label className="text-xs font-semibold text-muted" htmlFor="owner-email">
            {t("ownerEmail")}
          </label>
          <div className="flex gap-2">
            <input
              id="owner-email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setOwner(null);
                setNotFound(false);
              }}
              className="min-w-0 flex-1 rounded-xl border border-line-strong px-3 py-2 text-[15px] outline-none focus:border-primary"
            />
            <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-white disabled:opacity-50">
              <Search className="size-4" aria-hidden="true" />
              {t("findOwner")}
            </button>
          </div>
          {owner && <p className="text-[13px] font-semibold text-emerald-700">{t("ownerFound", { name: owner.name })}</p>}
          {notFound && <p className="text-[13px] font-medium text-danger">{t("ownerMissing")}</p>}
        </form>
      )}
      {ready && <ListingForm key={owner?.id ?? "viipa"} listingId={null} initial={EMPTY_LISTING} live={false} staff={{ ownerId: owner?.id ?? null }} />}
    </div>
  );
}
