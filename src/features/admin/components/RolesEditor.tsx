"use client";

import { ArrowRight, BedDouble, Check, Lock, ShieldCheck, UserRound, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { setPersonRoleAction } from "../actions";
import type { PersonRole } from "../service";
import { StaffAreasForm } from "./StaffAreasForm";

type Option = { id: string; name: string };
type Group = "CUSTOMER" | "STAFF" | "PLACE" | "RESTAURANT";

const GROUPS: { group: Group; icon: LucideIcon }[] = [
  { group: "CUSTOMER", icon: UserRound },
  { group: "STAFF", icon: ShieldCheck },
  { group: "PLACE", icon: BedDouble },
  { group: "RESTAURANT", icon: UtensilsCrossed },
];
const ROLES: Record<Group, PersonRole[]> = {
  CUSTOMER: ["CUSTOMER"],
  STAFF: ["STAFF_MANAGER", "STAFF_ADMIN"],
  PLACE: ["PLACE_OWNER", "PLACE_RECEPTIONIST"],
  RESTAURANT: ["RESTAURANT_OWNER", "RESTAURANT_MANAGER", "RESTAURANT_DELIVERY"],
};
const groupOf = (role: PersonRole): Group => (role === "CUSTOMER" ? "CUSTOMER" : (role.split("_")[0] as Group));
/** The icon of a role's kind. */
function RoleIcon({ role }: { role: PersonRole }) {
  const Icon = GROUPS.find((g) => g.group === groupOf(role))!.icon;
  return <Icon className="size-5" aria-hidden="true" />;
}

/**
 * The person's one role, easy to switch: pick the kind (Customer, VIIPA staff, Place, Restaurant), then the role in
 * it, then the place or restaurant when it needs one, and Save. The new role replaces the old one.
 */
export function RolesEditor({
  userId,
  self,
  canManage,
  current,
  staffAreas,
  ownedPlaces,
  ownedRestaurants,
  placeOptions,
  restaurantOptions,
}: {
  userId: string;
  self: boolean;
  canManage: boolean;
  current: { role: PersonRole; target: string };
  staffAreas: string[];
  ownedPlaces: Option[];
  ownedRestaurants: Option[];
  placeOptions: Option[];
  restaurantOptions: Option[];
}) {
  const t = useTranslations("Admin.rolesEditor");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(current);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = self || !canManage;
  const group = groupOf(draft.role);
  const needsTarget = group === "PLACE" || group === "RESTAURANT";
  const isOwner = draft.role.endsWith("_OWNER");
  const options = group === "PLACE" ? placeOptions : restaurantOptions;
  const owned = group === "PLACE" ? ownedPlaces : ownedRestaurants;
  const changed = draft.role !== current.role || (needsTarget && draft.target !== current.target);
  const missingTarget = needsTarget && draft.target === "new" && !isOwner;
  // An owner given an existing place or restaurant takes it over from its owner now.
  const handingOver = isOwner && draft.target !== "new" && !owned.some((o) => o.id === draft.target);

  const pickGroup = (g: Group) => {
    setMessage(null);
    setDraft(g === groupOf(current.role) ? current : { role: ROLES[g][0]!, target: "new" });
  };
  const pickRole = (role: PersonRole) => {
    setMessage(null);
    setDraft(role === current.role ? current : { role, target: role.endsWith("_OWNER") ? "new" : (options[0]?.id ?? "new") });
  };

  // A role in words, with its place or restaurant ("Receptionist · Lake Kivu beach house").
  const label = (x: { role: PersonRole; target: string }) => {
    const g = groupOf(x.role);
    const where = g === "PLACE" ? (placeOptions.find((o) => o.id === x.target) ?? ownedPlaces.find((o) => o.id === x.target))?.name : g === "RESTAURANT" ? (restaurantOptions.find((o) => o.id === x.target) ?? ownedRestaurants.find((o) => o.id === x.target))?.name : null;
    return [t(`role.${x.role}`), where].filter(Boolean).join(" · ");
  };

  const save = () =>
    start(async () => {
      const r = await setPersonRoleAction(userId, draft.role, needsTarget ? draft.target : "new");
      setMessage(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: t(`errors.${r.error}`) });
      if (r.ok) router.refresh();
    });

  const step = "text-[11px] font-bold tracking-[0.08em] text-muted uppercase";

  return (
    <div className="flex flex-col gap-5">
      {/* Their role now. */}
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] p-3.5 ring-1 ring-primary/15">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
          <RoleIcon role={current.role} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-muted">{t("now")}</span>
          <span className="block text-[16px] font-bold text-ink">
            {t(`role.${current.role}`)}
            {groupOf(current.role) !== "CUSTOMER" && <span className="font-medium text-muted"> · {t(`groups.${groupOf(current.role)}`)}</span>}
          </span>
        </span>
        {locked && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted ring-1 ring-line">
            <Lock className="size-3" aria-hidden="true" />
            {self ? t("youShort") : t("adminsOnlyShort")}
          </span>
        )}
      </div>

      {locked ? (
        <p className="text-[13px] text-muted">{self ? t("you") : t("adminsOnly")}</p>
      ) : (
        <>
          {/* 1. The kind of role. */}
          <section className="flex flex-col gap-2">
            <span className={step}>{t("step1")}</span>
            {/* Two rows of two (the card is narrow); the chosen one is filled. */}
            <div role="radiogroup" aria-label={t("group")} className="grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1 ring-1 ring-line">
              {GROUPS.map(({ group: g, icon: Icon }) => {
                const on = g === group;
                return (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickGroup(g)}
                    className={cn(
                      "flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
                      on ? "bg-primary text-white shadow-[0_6px_14px_-8px_rgba(0,87,184,0.9)]" : "text-ink/70 hover:bg-surface hover:text-ink",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {t(`groups.${g}`)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. The role in it, each with what it does. */}
          <section className="flex flex-col gap-2">
            <span className={step}>{t("step2")}</span>
            <div role="radiogroup" aria-label={t("roleLabel")} className="flex flex-col gap-2">
              {ROLES[group].map((r) => {
                const on = r === draft.role;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickRole(r)}
                    className={cn("flex items-start gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 transition-all", on ? "bg-primary/[0.06] ring-2 ring-primary" : "bg-surface ring-line hover:ring-line-strong")}
                  >
                    <span className={cn("mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-line-strong")}>
                      {on && <span className="size-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-ink">{t(`role.${r}`)}</span>
                      <span className="block text-[12px] leading-[17px] text-muted">{t(`hint.${r}`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Which place or restaurant. */}
          {needsTarget && (
            <section className="flex flex-col gap-2">
              <span className={step}>{t(group === "PLACE" ? "whichPlace" : "whichRestaurant")}</span>
              <Select
                aria-label={t(group === "PLACE" ? "whichPlace" : "whichRestaurant")}
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                className="w-full rounded-2xl border border-line-strong bg-surface px-3.5 py-3 text-[14px] font-medium text-ink"
              >
                <option value="new">{isOwner ? t(group === "PLACE" ? "newPlace" : "newRestaurant") : t("choose")}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
              {owned.length > 0 && isOwner && (
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  {t("owns")}
                  {owned.map((o) => (
                    <Link key={o.id} href={group === "PLACE" ? `/admin/listings/${o.id}` : `/admin/restaurants/${o.id}`} className="rounded-full bg-canvas px-2.5 py-1 font-semibold text-ink ring-1 ring-line hover:ring-primary">
                      {o.name}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Save: what changes, then the buttons. */}
          {changed && (
            // The card is narrow: the change on its own line (wrapping, never cut), the buttons below, side by side.
            <div className="flex flex-col gap-3 rounded-2xl bg-ink/[0.03] p-3.5 ring-1 ring-line">
              <span className="flex flex-col gap-1 text-[13px]">
                <span className="text-muted line-through decoration-muted/50">{label(current)}</span>
                <span className="flex items-start gap-1.5">
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <b className="font-semibold text-ink">{label(draft)}</b>
                </span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => (setDraft(current), setMessage(null))} className="h-11 rounded-xl px-4 text-[14px] font-semibold text-ink ring-1 ring-line hover:bg-surface">
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  disabled={missingTarget || pending}
                  onClick={save}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(0,87,184,0.9)] hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none"
                >
                  <Check className="size-4" aria-hidden="true" />
                  {pending ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          )}
          {changed && handingOver && <p className="-mt-2 text-[12px] font-medium text-amber-800">{t("handOver", { name: options.find((o) => o.id === draft.target)?.name ?? "" })}</p>}
        </>
      )}

      {current.role === "STAFF_MANAGER" && draft.role === "STAFF_MANAGER" && !self && (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <span className={step}>{t("areas")}</span>
          <StaffAreasForm userId={userId} initial={staffAreas} canManage={canManage} />
        </section>
      )}

      {message && (
        <p role="status" className={cn("rounded-xl px-3 py-2 text-[13px] font-medium", message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-danger")}>
          {message.text}
        </p>
      )}
    </div>
  );
}
