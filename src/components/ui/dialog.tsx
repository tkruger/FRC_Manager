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
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        className={cn(
          // Mobile: slide up from bottom as a sheet
          "fixed z-50 w-full bg-[--color-surface-raised] shadow-xl",
          "inset-x-0 bottom-0 rounded-t-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          // Desktop: centred modal
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
          "sm:border sm:border-[--color-border]",
          "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]",
          "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
          "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          className
        )}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[--color-border]" />
        </div>

        <div className="flex items-start justify-between px-5 pt-3 pb-4 border-b border-[--color-border]">
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
          <RadixDialog.Close className="ml-4 h-9 w-9 rounded-md flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] hover:text-[--color-text-primary] transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </RadixDialog.Close>
        </div>

        {/* Scrollable body for tall content on small screens */}
        <div className="p-5 overflow-y-auto max-h-[70vh] sm:max-h-[80vh]">
          {children}
        </div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
