"use client";

import { useState } from "react";
import type { RedactedResult } from "@/lib/types";
import { IconCheck, IconShare } from "./icons";
import { Button } from "./ui";

export function ShareButton({ share }: { share: { redactedResult: RedactedResult; shareToken: string } }) {
  const [state, setState] = useState<{ k: "idle" | "busy" | "done" | "error"; url?: string; msg?: string }>({ k: "idle" });

  async function create() {
    setState({ k: "busy" });
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(share),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't create a link");
      const url = new URL(data.url, window.location.origin).toString();
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard may be blocked; the link is still shown */
      }
      setState({ k: "done", url });
    } catch (e) {
      setState({ k: "error", msg: (e as Error).message });
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-rule-strong px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-2">
          <span className="font-semibold text-ink">Warn your friends.</span> Share a redacted card: no emails, phone numbers or UPI IDs.
        </p>
        <Button variant="secondary" onClick={create} loading={state.k === "busy"} disabled={state.k === "done"}>
          {state.k === "done" ? <IconCheck size={16} /> : <IconShare size={16} />}
          {state.k === "done" ? "Link copied" : "Share warning card"}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 break-all font-mono text-[12px] text-muted empty:hidden">
        {state.k === "done" && state.url ? (
          <a href={state.url} className="text-ink underline underline-offset-4">
            {state.url}
          </a>
        ) : state.k === "error" ? (
          <span className="text-risk-ink">{state.msg}</span>
        ) : null}
      </p>
    </div>
  );
}
