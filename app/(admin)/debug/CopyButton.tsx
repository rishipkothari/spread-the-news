"use client";

import { useState } from "react";

/** Copies text to the clipboard. Secondary since "Send to Claude" (app/_feedback/SendToClaude.tsx) sends reports directly. */
export default function CopyButton({ text, label = "Copy report", primary = false }: { text: string; label?: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={primary ? "primary" : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          alert("Clipboard blocked — open the report preview at the bottom and copy it by hand.");
        }
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
