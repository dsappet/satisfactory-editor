import { ShieldCheck } from "lucide-react";

export function PrivacyBanner() {
  return (
    <div className="rounded-lg border bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
      <ShieldCheck className="size-5 shrink-0 mt-0.5" aria-hidden />
      <div>
        <strong className="font-semibold">
          Your save never leaves your browser.
        </strong>{" "}
        All parsing and editing happens locally in a Web Worker. No uploads, no
        analytics, no external requests.
      </div>
    </div>
  );
}
