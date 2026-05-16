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
        "flex h-10 w-full rounded-md border bg-[--color-surface] px-3 py-2 text-sm text-[--color-text-primary] placeholder:text-[--color-text-disabled] transition-colors",
        "border-[--color-border] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-[--color-danger] focus:ring-[--color-danger]/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
