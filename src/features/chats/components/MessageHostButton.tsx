"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { startConversationAction } from "../actions";

/** Opens (or reopens) the chat with this place's host; signed-out visitors log in first. */
export function MessageHostButton({ listingId, signedIn, className, children }: { listingId: string; signedIn: boolean; className: string; children: ReactNode }) {
  const t = useTranslations("Chats");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link href={{ pathname: "/login", query: { next: pathname } }} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() =>
          start(async () => {
            const result = await startConversationAction(listingId);
            if (result.ok) router.push(`/chats/${result.id}`);
            else setError(t(`startError.${result.error}`));
          })
        }
      >
        {children}
      </button>
      {error && (
        <span role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
