import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // h-11 (44px) meets WCAG 2.5.5 minimum touch target on all viewports
        "flex h-11 w-full rounded-md border px-3 py-2.5 text-sm transition-colors",
        "bg-[--color-surface] text-[--color-text-primary] placeholder:text-[--color-text-disabled]",
        "border-[--color-border] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // date/time inputs inherit color-scheme from :root / [data-theme="dark"]
        // so the picker icon and calendar popup match the current theme automatically
        error && "border-[--color-danger] focus:ring-[--color-danger]/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
