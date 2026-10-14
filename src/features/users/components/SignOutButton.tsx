"use client";

import { ChevronRight, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { authClient } from "@/lib/auth-client";

/** "Log out" row; asks for confirmation in a window (bottom sheet on phones) before signing out. */
export function SignOutButton() {
  const t = useTranslations("Profile");
  const tHome = useTranslations("Home");
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    // Full load: a client push to "/" keeps the shared (main) layout, which would still show the signed-in header.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${locale}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-full items-center gap-4 rounded-2xl py-4 text-left text-[15px] font-semibold text-danger transition-colors hover:bg-danger/[0.04] active:bg-danger/[0.08]"
      >
        <LogOut className="size-6 text-danger" strokeWidth={1.8} aria-hidden="true" />
        <span className="flex-1">{t("logOut")}</span>
        <ChevronRight className="size-5 text-danger/60" aria-hidden="true" />
      </button>
      {confirming && (
        <Modal title={t("logOutTitle")} closeLabel={tHome("close")} onClose={() => setConfirming(false)}>
          <p className="-mt-2 text-center text-[15px] leading-6 text-muted">{t("logOutBody")}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" fullWidth loading={pending} onClick={signOut} className="bg-danger hover:bg-danger/90">
              {t("logOut")}
            </Button>
            <Button size="lg" fullWidth variant="outline" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
