/**
 * The frame the card's dialogs share: a header, a scrollable body (usable at
 * 1280×720) and a footer that stays in view.
 *
 * `locked` is for the call popup (spec §7): no Escape, no click outside, no X —
 * the dialog only closes through the code that saved (or confirmed cancelling).
 */
import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DialogFrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** read by screen readers; the visible subtitle is part of the body */
  description: string;
  children: ReactNode;
  locked?: boolean;
  /** tailwind max-width class */
  widthClass?: string;
}

export function DialogFrame({
  open,
  onOpenChange,
  title,
  description,
  children,
  locked = false,
  widthClass = 'max-w-xl',
}: DialogFrameProps) {
  const stop = (e: Event) => {
    if (locked) e.preventDefault();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (locked && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          onEscapeKeyDown={stop}
          onPointerDownOutside={stop}
          onInteractOutside={stop}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            widthClass,
          )}
        >
          <div className="shrink-0 border-b border-border px-5 py-3 pr-12">
            <DialogTitle className="text-[15px]">{title}</DialogTitle>
            <DialogDescription className="sr-only">{description}</DialogDescription>
          </div>
          {children}
          {!locked && (
            <DialogPrimitive.Close
              aria-label="Yopish"
              className="absolute right-3 top-3 inline-flex h-7 w-7 min-h-0 min-w-0 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4', className)}>{children}</div>;
}

export function DialogFoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('shrink-0 space-y-2 border-t border-border bg-card px-5 py-3', className)}>{children}</div>
  );
}
