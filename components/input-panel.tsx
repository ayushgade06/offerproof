"use client";

import { useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { downscaleImage, validateImageFile } from "@/lib/image";
import { SAMPLES, type Sample } from "@/lib/samples";
import { IconArrowRight, IconImage, IconX } from "./icons";
import { Button, cx } from "./ui";

export const MAX_TEXT = 12_000;

export interface InputValue {
  text: string;
  image: { dataUrl: string; name: string } | null;
}

export function InputPanel({
  value,
  onChange,
  onSubmit,
  onSample,
  busy,
}: {
  value: InputValue;
  onChange: (v: InputValue) => void;
  onSubmit: () => void;
  onSample: (s: Sample) => void;
  busy: boolean;
}) {
  const textId = useId();
  const fileId = useId();
  const errId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  const over = value.text.length > MAX_TEXT;
  const canSubmit = !busy && !reading && !over && (value.image !== null || value.text.trim().length > 0);

  async function takeFile(file: File | undefined | null) {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    setReading(true);
    try {
      const dataUrl = await downscaleImage(file);
      onChange({ ...value, image: { dataUrl, name: file.name || "Pasted screenshot" } });
    } catch {
      setFileError("We couldn't open that image. Try a PNG or JPG screenshot.");
    } finally {
      setReading(false);
    }
  }

  function onPaste(e: ClipboardEvent) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (item) {
      e.preventDefault();
      void takeFile(item.getAsFile());
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void takeFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div>
      <form
        className="receipt rounded-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
          <label htmlFor={textId} className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            The message
          </label>
          <span className="font-mono text-[11px] text-muted" aria-hidden>
            Text or screenshot
          </span>
        </div>

        <div className={cx("relative mx-5 mt-3 sm:mx-6", dragging && "rounded-md outline-2 outline-dashed outline-ink/40 outline-offset-4")}>
          {value.image ? (
            <div className="flex items-start gap-4 rounded-md border border-rule bg-paper-2 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.image.dataUrl} alt="Screenshot to check" className="h-28 w-auto max-w-[45%] rounded border border-rule object-cover object-top" />
              <div className="min-w-0 flex-1 py-1">
                <p className="truncate text-sm font-medium">{value.image.name}</p>
                <p className="mt-1 text-[13px] text-muted">We&apos;ll read the text in this screenshot, then check it.</p>
                {value.text.trim() && <p className="mt-2 text-[13px] text-warn-ink">The text you typed will be ignored while a screenshot is attached.</p>}
                <button
                  type="button"
                  onClick={() => onChange({ ...value, image: null })}
                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-ink-2 hover:bg-card hover:text-ink"
                >
                  <IconX size={14} /> Remove screenshot
                </button>
              </div>
            </div>
          ) : (
            <textarea
              id={textId}
              value={value.text}
              onChange={(e) => onChange({ ...value, text: e.target.value })}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) onSubmit();
              }}
              rows={8}
              placeholder="Paste the message, email or offer letter text…"
              aria-describedby={`${errId} ${textId}-count`}
              aria-invalid={over || undefined}
              className="block min-h-48 w-full resize-y rounded-md border border-rule bg-paper/60 px-4 py-3 font-mono text-[14px] leading-relaxed text-ink placeholder:text-muted/80 focus:border-ink/40 focus:bg-card focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-5 pb-6 sm:px-6">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                void takeFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <label
              htmlFor={fileId}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-rule-strong px-3.5 text-sm font-medium text-ink-2 hover:border-ink/40 hover:bg-paper-2 hover:text-ink"
            >
              <IconImage size={17} />
              {reading ? "Reading image…" : value.image ? "Replace screenshot" : "Add screenshot"}
            </label>
            {!value.image && (
              <span id={`${textId}-count`} className={cx("font-mono text-xs tabular-nums", over ? "font-semibold text-risk-ink" : "text-muted")}>
                {value.text.length.toLocaleString("en-US")}/{MAX_TEXT.toLocaleString("en-US")}
              </span>
            )}
          </div>
          <Button type="submit" size="lg" disabled={!canSubmit} loading={busy} className="w-full sm:w-auto">
            Check offer <IconArrowRight size={17} />
          </Button>
        </div>
        <p id={errId} role="alert" className={cx("px-5 pb-5 text-[13px] text-risk-ink sm:px-6", !fileError && !over && "sr-only")}>
          {fileError ?? (over ? `That's over ${MAX_TEXT.toLocaleString("en-US")} characters. Trim it to the message itself.` : "")}
        </p>
      </form>

      <div className="mt-9">
        <p className="mb-3 text-sm text-muted">
          No message to hand? Try a <span className="font-medium text-ink-2">fictional example</span>:
        </p>
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {SAMPLES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSample(s)}
                className="group flex h-full min-h-[72px] w-full flex-col items-start justify-center rounded-lg border border-rule bg-card/70 px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-ink/30 hover:bg-card hover:shadow-card disabled:opacity-50"
              >
                <span className="flex w-full items-center justify-between text-sm font-medium">
                  {s.label}
                  <span className="font-mono text-[10px] text-muted">0{i + 1}</span>
                </span>
                <span className="mt-0.5 text-[12.5px] text-muted">{s.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
