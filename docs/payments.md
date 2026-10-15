# Payment callbacks

Bookings are confirmed only when the payment provider reports a verified payment. Whichever provider is chosen (MTN MoMo,
Airtel Money or a gateway), a small adapter turns its callback into the format below and posts it to:

`POST /api/v1/payments/callback`

## Body (JSON)

| Field | Meaning |
| --- | --- |
| `eventId` | The provider's unique id for this callback. A repeated id is recognised and ignored. |
| `provider` | Short name, e.g. `mtn-momo`. |
| `type` | `payment.succeeded` or `payment.failed`. |
| `bookingReference` | Our booking code, e.g. `SR-7K2M9Q` (sent to the provider when requesting payment). |
| `amount` | Whole RWF actually collected. Must equal the booking's total or it is flagged, not confirmed. |
| `currency` | `RWF`. |
| `providerReference` | The provider's transaction id (shown on the receipt; one payment per id). |

## Signature

Header `x-payment-signature: t=<unix seconds>,v1=<hex>` where `<hex>` is HMAC-SHA256 of `"<t>.<raw body>"` with the
shared secret `PAYMENT_WEBHOOK_SECRET`. Callbacks older than 5 minutes, unsigned, or with a wrong signature get `401`.

## What happens

- **Succeeded, right amount, booking waiting:** booking confirmed, payment and ledger recorded (guest payment, owner
  payable, commission, service fee, deposit, promo), guest and owner notified, receipt shows the transaction id.
- **Succeeded after the hold ended:** confirmed if the dates are still free; otherwise kept on record and flagged in
  Admin → Money for a refund.
- **Wrong amount, unknown booking:** recorded and flagged in Admin → Money; nothing confirmed.
- **Failed:** recorded; the guest is told and can try again while the dates are held.

The provider-specific part still to build: requesting the payment on the guest's phone when they book, and refunds.
