"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

interface DialogContentProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export function DialogContent({ children, title, description, className }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-lg border border-[--color-border] bg-[--color-surface-raised] shadow-xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
      >
        <div className="flex items-start justify-between p-5 border-b border-[--color-border]">
          <div>
            <RadixDialog.Title className="text-h3 text-[--color-text-primary]">
              {title}
            </RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="mt-1 text-small text-[--color-text-secondary]">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close className="ml-4 rounded-md p-1 text-[--color-text-secondary] hover:bg-[--color-surface-overlay] hover:text-[--color-text-primary] transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </RadixDialog.Close>
        </div>
        <div className="p-5">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
