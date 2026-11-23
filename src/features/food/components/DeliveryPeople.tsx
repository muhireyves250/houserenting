"use client";

import { Bike, Check, Search, Trash2, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { addRestaurantMemberAction, findPersonByEmailAction, removeRestaurantMemberAction } from "../actions";

type Role = "MANAGER" | "DELIVERY";
type Member = { id: string; name: string; email: string; role: Role };

/**
 * The restaurant's people: the owner sees and adds managers and delivery people, a manager delivery people only. To
 * add one, type their exact email: their name shows so you can check it is the right person, then Yes adds them.
 * Nobody's list of users is shown.
 */
export function DeliveryPeople({ restaurantId, members, roles }: { restaurantId: string; members: Member[]; roles: Role[] }) {
  const t = useTranslations("Food.deliveryTeam");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<{ name: string; email: string } | null>(null);
  const [role, setRole] = useState<Role>(roles.includes("DELIVERY") ? "DELIVERY" : roles[0]!);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const find = () =>
    start(async () => {
      setMessage(null);
      const r = await findPersonByEmailAction(restaurantId, email);
      if (r.ok) setFound({ name: r.name, email: r.email });
      else setMessage({ ok: false, text: t(`error.${r.error}`) });
    });
  const add = () =>
    start(async () => {
      const r = await addRestaurantMemberAction(restaurantId, found!.email, role);
      if (r.ok) {
        setMessage({ ok: true, text: t(role === "MANAGER" ? "addedManager" : "added", { name: found!.name }) });
        setFound(null);
        setEmail("");
        router.refresh();
      } else setMessage({ ok: false, text: t(`error.${r.error}`) });
    });

  return (
    <div className="flex flex-col gap-5">
      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-canvas py-8 text-center">
          <Bike className="size-8 text-line-strong" aria-hidden="true" />
          <p className="text-[15px] font-semibold text-ink">{roles.length > 1 ? t("none") : t("noneDelivery")}</p>
          <p className="max-w-sm text-[13px] text-muted">{t("noneHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {m.role === "MANAGER" ? <UserRound className="size-5" aria-hidden="true" /> : <Bike className="size-5" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{m.name}</span>
                <span className="block truncate text-[12px] text-muted">
                  <b className="font-semibold text-ink/70">{t(`role.${m.role}`)}</b> · {m.email}
                </span>
              </span>
              <button
                type="button"
                aria-label={t("remove", { name: m.name })}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await removeRestaurantMemberAction(m.id);
                    router.refresh();
                  })
                }
                className="flex size-10 items-center justify-center rounded-full text-danger hover:bg-danger/5"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add one: their exact email, then check the name. */}
      <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-4">
        <p className="text-[15px] font-semibold text-ink">{roles.length > 1 ? t("addPerson") : t("addTitle")}</p>
        <p className="-mt-2 text-[13px] text-muted">{t("addHint")}</p>
        {/* The owner picks what they'll do: manager or delivery person. */}
        {roles.length > 1 && !found && (
          <div role="radiogroup" aria-label={t("asRole")} className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
            {roles.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={role === r ? "h-11 rounded-lg bg-primary text-[14px] font-semibold text-white" : "h-11 rounded-lg text-[14px] font-semibold text-ink hover:bg-canvas"}>
                {t(`role.${r}`)}
              </button>
            ))}
          </div>
        )}
        {found ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-2 ring-primary">
            <p className="text-[14px] text-ink">{t("isThis", { role: t(`role.${role}`) })}</p>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-white">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] font-bold text-ink">{found.name}</span>
                <span className="block truncate text-[13px] text-muted">{found.email}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setFound(null)} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                <X className="size-4" aria-hidden="true" />
                {t("no")}
              </button>
              <button type="button" disabled={pending} onClick={add} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                <Check className="size-4" aria-hidden="true" />
                {t("yesAdd")}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              find();
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              aria-label={t("emailPlaceholder")}
              className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-[15px] text-ink outline-none focus:border-primary"
            />
            <button type="submit" disabled={pending || !email.includes("@")} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
              <Search className="size-4" aria-hidden="true" />
              {t("find")}
            </button>
          </form>
        )}
        {message && <p className={message.ok ? "text-[14px] font-medium text-emerald-700" : "text-[14px] font-medium text-danger"}>{message.text}</p>}
      </div>
    </div>
  );
}
