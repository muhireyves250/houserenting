import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1>Page not found</h1>
        <Link href="/">Go to home</Link>
      </body>
    </html>
  );
}
