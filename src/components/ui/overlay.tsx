"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-[16rem] rounded-[3px] border border-[var(--line-strong)] bg-[var(--surface-3)] px-2.5 py-1.5 text-[11px] leading-snug text-[var(--text)] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-[var(--surface-3)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  onEscape,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  onEscape?: () => void;
  ariaLabel: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
      <DialogPrimitive.Content
        aria-label={ariaLabel}
        onEscapeKeyDown={onEscape}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[min(1040px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[4px] border border-[var(--line-strong)] bg-[var(--surface-0)] shadow-[0_40px_120px_rgba(0,0,0,0.7)] outline-none data-[state=open]:animate-[dialog-in_180ms_cubic-bezier(0.2,0.8,0.2,1)]",
          className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]",
        className,
      )}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

export const DialogDescription = DialogPrimitive.Description;
