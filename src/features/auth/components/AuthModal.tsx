"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { Modal } from "@/components/ui/Modal";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

type Mode = "login" | "signup" | "forgot";

const PATH: Record<Mode, string> = { login: "login", signup: "signup", forgot: "forgot-password" };
const MODAL_PATHS = new Set(["/login", "/signup", "/forgot-password"]);

/**
 * Log in / Sign up as a dialog over the current page (opened from the header via an intercepted
 * route). Direct visits to /login or /signup still render the full pages.
 */
export function AuthModal({ initialMode, next }: { initialMode: Exclude<Mode, "forgot">; next: string }) {
  const t = useTranslations("Auth");
  const tHome = useTranslations("Home");
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const pathname = usePathname();

  function go(value: Mode) {
    setMode(value);
    // Keep the address bar in step without re-mounting the modal.
    const query = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    window.history.replaceState(null, "", `/${locale}/${PATH[value]}${query}`);
  }

  // The modal slot keeps its last content on soft navigation; hide once we leave /login or /signup.
  if (!MODAL_PATHS.has(pathname)) return null;

  return (
    <Modal
      closeLabel={tHome("close")}
      onClose={() => router.back()}
      title={
        <span className="flex flex-col items-center">
          <LogoMark className="h-10 w-11 text-primary" />
          {/* No visible heading text, but the dialog still needs an accessible name. */}
          <span className="sr-only">{t("modalTitle")}</span>
        </span>
      }
    >
      {mode === "forgot" ? (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-ink">{t("forgotTitle")}</h3>
            <p className="mt-1 text-sm text-muted">{t("forgotBody")}</p>
          </div>
          <ForgotPasswordForm />
          <button
            type="button"
            onClick={() => go("login")}
            className="inline-flex items-center justify-center gap-1 self-center text-sm font-semibold text-primary hover:underline"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t("backToLogin")}
          </button>
        </div>
      ) : (
        <>
          <SegmentedTabs
            label={t("modalTitle")}
            value={mode}
            onChange={go}
            options={[
              { value: "login", label: t("loginTitle") },
              { value: "signup", label: t("signupTitle") },
            ]}
            className="mb-6 border border-primary/40"
          />
          {mode === "login" ? (
            <LoginForm
              next={next}
              onForgot={() => go("forgot")}
              // Full reload of the page underneath so the header and layout show the signed-in user.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              onSuccess={() => window.location.assign(`/${locale}${next === "/" ? "" : next}`)}
            />
          ) : (
            <SignupForm />
          )}
        </>
      )}
    </Modal>
  );
}
