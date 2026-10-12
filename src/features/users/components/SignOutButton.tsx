"use client";

import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      size="lg"
      loading={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        // Full load: a client push to "/" keeps the shared (main) layout, which would still show the signed-in header.
        window.location.assign(`/${locale}`);
      }}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {t("signOut")}
    </Button>
  );
}
