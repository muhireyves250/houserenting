import { ChartColumn, Receipt, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageTabs, StickyTabs } from "@/features/admin/components/kit";
import { MoneyView } from "@/features/admin/views/MoneyView";
import { ReportsView } from "@/features/admin/views/ReportsView";
import { AllReceipts } from "@/features/receipt/components/AllReceipts";
import { ReceiptForm } from "@/features/receipt/components/ReceiptForm";
import { getReceiptDetails } from "@/features/receipt/service";
import { requireStaff } from "@/lib/permissions";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

/** Money in one place: payouts and payments, reports, and what guests' receipts show. */
export default async function MoneyAndReportsPage({ searchParams }: Props) {
  await requireStaff("money", "/admin/money");
  const params = await searchParams;
  const tab =
    params.tab === "reports" || params.tab === "receipt" ? params.tab : "money";
  const t = await getTranslations("Admin");
  return (
    <div className="flex flex-col gap-5">
      <StickyTabs>
        <PageTabs
          label={t("nav.money")}
          items={[
            {
              key: "money",
              label: t("pageTabs.money"),
              icon: Wallet,
              href: { pathname: "/admin/money" },
              on: tab === "money",
            },
            {
              key: "reports",
              label: t("pageTabs.reports"),
              icon: ChartColumn,
              href: { pathname: "/admin/money", query: { tab: "reports" } },
              on: tab === "reports",
            },
            {
              key: "receipt",
              label: t("pageTabs.receipt"),
              icon: Receipt,
              href: { pathname: "/admin/money", query: { tab: "receipt" } },
              on: tab === "receipt",
            },
          ]}
        />
      </StickyTabs>
      {tab === "reports" ? (
        <ReportsView searchParams={Promise.resolve(params)} />
      ) : tab === "receipt" ? (
        <>
          <AllReceipts
            q={params.rq ?? ""}
            page={Math.max(1, Number.parseInt(params.rpage ?? "1", 10) || 1)}
          />
          <ReceiptForm initial={await getReceiptDetails()} />
        </>
      ) : (
        <MoneyView searchParams={Promise.resolve(params)} />
      )}
    </div>
  );
}
