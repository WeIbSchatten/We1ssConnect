'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyCommand({ command, copy, copied }: { command: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border bg-fd-card py-2.5 pe-2 ps-4 text-sm">
      <span className="select-none font-mono text-fd-muted-foreground">$</span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-start font-mono">{command}</code>
      <button
        type="button"
        aria-label={done ? copied : copy}
        onClick={() =>
          navigator.clipboard?.writeText(command).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          })
        }
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-fd-muted-foreground hover:bg-fd-accent"
      >
        {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
