import { getLocale } from "next-intl/server";
import { receiptPdf } from "@/features/receipt/pdf";
import { paymentReceipt } from "@/features/receipt/payment-receipt";
import { canStaff } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

/** A payment's receipt as a PDF: for the guest who paid, or staff who handle money or messages. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { paymentId } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(paymentId))
    return new Response("Not found", { status: 404 });
  const lang = new URL(request.url).searchParams.get("lang");
  const locale =
    lang === "fr" || lang === "rw" || lang === "en"
      ? lang
      : await getLocale().catch(() => "en");
  const receipt = await paymentReceipt(paymentId, locale);
  const allowed =
    receipt &&
    (receipt.booking.guestId === user.id ||
      canStaff(user, "money") ||
      canStaff(user, "messages"));
  if (!receipt || !allowed || receipt.payment.status !== "SUCCEEDED")
    return new Response("Not found", { status: 404 });
  const pdf = await receiptPdf(receipt);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${receipt.booking.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
