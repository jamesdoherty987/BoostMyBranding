'use client';

/**
 * Imperative confirm dialog — a drop-in replacement for the browser's
 * native `confirm()` with proper branding, keyboard support, and a11y.
 *
 * Usage:
 *   if (await confirmDialog({
 *     title: 'Delete this post?',
 *     description: 'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     danger: true,
 *   })) {
 *     // do the thing
 *   }
 *
 * Implementation note: we mount a single portal-root div lazily and render
 * React into it. Each call resolves its own promise when the user picks
 * an option. This keeps the API promise-based like `window.confirm` so
 * calling code can stay synchronous-looking.
 */

import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Dialog } from './dialog';
import { Button } from './button';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Button label for the confirming action. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Button label for cancel. Defaults to "Cancel". */
  cancelLabel?: string;
  /** When true, shows a red confirm button + warning icon. */
  danger?: boolean;
}

let rootInstance: Root | null = null;
let containerEl: HTMLDivElement | null = null;

function ensureRoot(): Root {
  if (rootInstance) return rootInstance;
  containerEl = document.createElement('div');
  containerEl.setAttribute('data-bmb-confirm-root', '');
  document.body.appendChild(containerEl);
  rootInstance = createRoot(containerEl);
  return rootInstance;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const root = ensureRoot();
    const cleanup = () => {
      // Defer unmount so the exit animation gets to play.
      setTimeout(() => root.render(null), 250);
    };
    root.render(
      <ConfirmHost
        options={options}
        onResult={(result) => {
          resolve(result);
          cleanup();
        }}
      />,
    );
  });
}

function ConfirmHost({
  options,
  onResult,
}: {
  options: ConfirmOptions;
  onResult: (ok: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  // Open on mount in a separate tick so the entrance animation plays.
  useEffect(() => {
    setOpen(true);
  }, []);

  const handle = (ok: boolean) => {
    setOpen(false);
    // Small delay so the close animation finishes before the promise resolves.
    setTimeout(() => onResult(ok), 180);
  };

  return (
    <Dialog
      open={open}
      onClose={() => handle(false)}
      title={options.title}
      description={options.description}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => handle(false)}>
          {options.cancelLabel ?? 'Cancel'}
        </Button>
        <Button
          variant={options.danger ? 'danger' : 'primary'}
          onClick={() => handle(true)}
          autoFocus
        >
          {options.danger ? <AlertTriangle className="h-4 w-4" /> : null}
          {options.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Dialog>
  );
}
