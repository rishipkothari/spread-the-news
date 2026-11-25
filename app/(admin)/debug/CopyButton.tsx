"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copy report for Claude" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="primary"
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
      {copied ? "Copied ✓ — paste it to Claude" : label}
    </button>
  );
}
