import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Inter } from "next/font/google";
import Link from "next/link";
import { IconGithub } from "@/components/icons";
import { SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "OfferProof: scam-check any job or internship offer", template: "%s · OfferProof" },
  description: SITE.description,
  openGraph: { title: "OfferProof: receipts, not vibes", description: SITE.description, type: "website", siteName: "OfferProof" },
  twitter: { card: "summary_large_image", title: "OfferProof: receipts, not vibes", description: SITE.description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

function Wordmark() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2 rounded" aria-label="OfferProof home">
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-ink text-paper">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" />
          <path d="m9 11.5 2 2 4-4.5" />
        </svg>
      </span>
      <span className="font-serif text-[1.55rem] leading-none tracking-tight">
        Offer<span className="italic">Proof</span>
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/", label: "Check" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable} antialiased`}>
      <body className="relative flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <header className="relative z-10 border-b border-rule">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Wordmark />
            <nav aria-label="Main" className="flex items-center gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`${n.href === "/" ? "hidden sm:inline-flex" : "inline-flex"} min-h-11 items-center whitespace-nowrap rounded-md px-2 text-ink-2 hover:bg-paper-2 hover:text-ink sm:px-3`}
                >
                  {n.label}
                </Link>
              ))}
              <a
                href={SITE.repo}
                className="ml-1 inline-flex size-11 items-center justify-center rounded-md text-ink-2 hover:bg-paper-2 hover:text-ink"
                aria-label="Source code on GitHub"
              >
                <IconGithub size={19} />
              </a>
            </nav>
          </div>
        </header>
        <main id="main" className="relative z-10 flex-1">
          {children}
        </main>
        <footer className="relative z-10 border-t border-rule">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>Built for LaunchPad Hacks 2026 · Not legal or financial advice</p>
            <p className="flex gap-4">
              <Link href="/how-it-works#limitations" className="underline-offset-4 hover:text-ink hover:underline">
                Limitations
              </Link>
              <a href={SITE.repo} className="underline-offset-4 hover:text-ink hover:underline">
                GitHub
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
