import Link from "next/link";
import { Kicker } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <Kicker>Error 404</Kicker>
      <h1 className="mt-4 font-serif text-5xl tracking-tight">Nothing on this receipt.</h1>
      <p className="mt-4 text-ink-2">This page doesn&apos;t exist, or the shared card expired. Shared cards are kept for 90 days.</p>
      <Link href="/" className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-ink px-5 font-medium text-paper hover:bg-ink-2">
        Check an offer
      </Link>
    </div>
  );
}
