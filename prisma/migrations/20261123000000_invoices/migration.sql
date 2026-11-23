-- Booking invoices: numbered, versioned (corrections never overwrite), personal or company billing.
CREATE TYPE "InvoiceState" AS ENUM ('ISSUED', 'CANCELLED', 'CORRECTED');
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" "InvoiceState" NOT NULL DEFAULT 'ISSUED',
    "billToName" TEXT NOT NULL,
    "billToEmail" TEXT,
    "billToPhone" TEXT,
    "companyName" TEXT,
    "companyTin" TEXT,
    "contactPerson" TEXT,
    "address" TEXT,
    "extraInfo" TEXT,
    "lines" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "ebmRequested" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoice_number_key" ON "invoice"("number");
CREATE INDEX "invoice_bookingId_version_idx" ON "invoice"("bookingId", "version");
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
