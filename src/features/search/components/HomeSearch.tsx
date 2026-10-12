"use client";

import { Calendar, MapPin, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { TextField } from "@/components/ui/TextField";
import { buildSearchQuery, type SearchMode } from "@/features/search/params";
import { useRouter } from "@/i18n/navigation";

export function HomeSearch() {
  const t = useTranslations("Home");
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("short");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    router.push({ pathname: "/search", query: buildSearchQuery(mode, values) });
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <SegmentedTabs
        label={t("modeLabel")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "short", label: t("short") },
          { value: "long", label: t("long") },
        ]}
        className="md:max-w-md md:self-center"
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-sm md:flex-row md:items-end md:gap-4 md:p-4 md:pl-6">
        <TextField name="location" label={t("location")} hideLabel placeholder={t("location")} icon={<MapPin />} autoComplete="off" className="md:flex-1" />
        {mode === "short" && (
          <>
            <TextField name="checkIn" type="date" label={t("checkIn")} icon={<Calendar />} className="md:w-44" />
            <TextField name="checkOut" type="date" label={t("checkOut")} icon={<Calendar />} className="md:w-44" />
            <TextField
              name="guests"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              label={t("guests")}
              hideLabel
              placeholder={t("guests")}
              icon={<Users />}
              className="md:w-48"
            />
          </>
        )}
        <Button type="submit" size="lg" fullWidth className="md:w-auto">
          {t("search")}
        </Button>
      </form>
    </div>
  );
}
