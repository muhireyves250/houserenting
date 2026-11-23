"use client";

import { Check } from "lucide-react";
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

const GROUPS: Group[] = ["CUSTOMER", "STAFF", "PLACE", "RESTAURANT"];
const ROLES: Record<Group, PersonRole[]> = {
  CUSTOMER: ["CUSTOMER"],
  STAFF: ["STAFF_MANAGER", "STAFF_ADMIN"],
  PLACE: ["PLACE_OWNER", "PLACE_RECEPTIONIST"],
  RESTAURANT: ["RESTAURANT_OWNER", "RESTAURANT_MANAGER", "RESTAURANT_DELIVERY"],
};
const groupOf = (role: PersonRole): Group => (role === "CUSTOMER" ? "CUSTOMER" : (role.split("_")[0] as Group));

/** Tap one of a few choices (VIIPA's segmented buttons). */
function Choice<T extends string>({ value, options, onChange, disabled, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid w-full auto-cols-fr grid-flow-col rounded-xl bg-canvas p-1 ring-1 ring-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-2 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed",
            value === o.value ? "bg-primary text-white shadow-sm" : "text-ink hover:bg-surface disabled:opacity-60",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The person's one role, easy to switch: tap the group (Customer, VIIPA staff, Place, Restaurant), tap the role in
 * it, choose the place or restaurant when it needs one, Save. The new role replaces the old one.
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
  const locked = self || !canManage || pending;
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
    if (g === groupOf(current.role)) return setDraft(current);
    setDraft({ role: ROLES[g][0]!, target: "new" });
  };
  const pickRole = (role: PersonRole) => {
    setMessage(null);
    setDraft(role === current.role ? current : { role, target: role.endsWith("_OWNER") ? "new" : (options[0]?.id ?? "new") });
  };

  const save = () =>
    start(async () => {
      const r = await setPersonRoleAction(userId, draft.role, needsTarget ? draft.target : "new");
      setMessage(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: t(`errors.${r.error}`) });
      if (r.ok) router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        {t("now")} <b className="font-semibold text-ink">{t(`role.${current.role}`)}</b>
      </p>

      <Choice label={t("group")} value={group} disabled={locked} options={GROUPS.map((g) => ({ value: g, label: t(`groups.${g}`) }))} onChange={pickGroup} />

      {group !== "CUSTOMER" && <Choice label={t("roleLabel")} value={draft.role} disabled={locked} options={ROLES[group].map((r) => ({ value: r, label: t(`role.${r}`) }))} onChange={pickRole} />}

      {needsTarget && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted">{t(group === "PLACE" ? "whichPlace" : "whichRestaurant")}</span>
          <Select
            aria-label={t(group === "PLACE" ? "whichPlace" : "whichRestaurant")}
            value={draft.target}
            disabled={locked}
            onChange={(e) => setDraft({ ...draft, target: e.target.value })}
            className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink"
          >
            {isOwner ? <option value="new">{t(group === "PLACE" ? "newPlace" : "newRestaurant")}</option> : <option value="new">{t("choose")}</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <p className="text-[12px] text-muted">{self ? t("you") : !canManage ? t("adminsOnly") : t(`hint.${draft.role}`)}</p>

      {/* What they own now (owners keep these; hand them over before giving another role). */}
      {owned.length > 0 && isOwner && (
        <div className="flex flex-wrap gap-2">
          {owned.map((o) => (
            <Link key={o.id} href={group === "PLACE" ? `/admin/listings/${o.id}` : `/admin/restaurants/${o.id}`} className="rounded-full bg-canvas px-3 py-1 text-[13px] text-ink ring-1 ring-line hover:ring-primary">
              {o.name}
            </Link>
          ))}
        </div>
      )}

      {changed && !locked && (
        <div className="flex flex-col gap-2 rounded-xl bg-canvas p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className={cn("text-[13px]", handingOver ? "font-medium text-amber-800" : "text-muted")}>
            {handingOver ? t("handOver", { name: options.find((o) => o.id === draft.target)?.name ?? "" }) : t("replaces", { role: t(`role.${current.role}`) })}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => (setDraft(current), setMessage(null))} className="rounded-full px-3 py-2 text-[13px] font-semibold text-ink hover:bg-surface">
              {t("cancel")}
            </button>
            <button type="button" disabled={missingTarget} onClick={save} className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
              <Check className="size-4" aria-hidden="true" />
              {t("save")}
            </button>
          </div>
        </div>
      )}
      {pending && <p className="text-[13px] text-muted">{t("saving")}</p>}

      {current.role === "STAFF_MANAGER" && draft.role === "STAFF_MANAGER" && !self && <StaffAreasForm userId={userId} initial={staffAreas} canManage={canManage} />}

      {message && (
        <p role="status" className={message.ok ? "text-[13px] font-medium text-emerald-700" : "text-[13px] font-medium text-danger"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
