/**
 * A receipt staff sent into a chat travels in the message text as a last line "[receipt:<paymentId>]"; the chat
 * shows it as a card to download the PDF. Only honoured on messages from VIIPA's side.
 */
const MARKER = /\n?\[receipt:([a-z0-9]{10,40})\]\s*$/i;

export const receiptMarker = (paymentId: string) => `[receipt:${paymentId}]`;

export function splitReceipt(body: string): {
  text: string;
  receiptId: string | null;
} {
  const m = MARKER.exec(body);
  return m
    ? { text: body.slice(0, m.index).trimEnd(), receiptId: m[1]! }
    : { text: body, receiptId: null };
}
