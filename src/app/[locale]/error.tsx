"use client";

import * as Sentry from "@sentry/nextjs";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Errors");
  const tCommon = useTranslations("Common");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <PageContainer className="py-16">
      <EmptyState icon={<TriangleAlert />} title={t("title")} body={t("body")} action={<Button onClick={reset}>{tCommon("tryAgain")}</Button>} />
    </PageContainer>
  );
}
