import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, required, ...props }, ref) => {
    const fieldId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col">
        {label && (
          <label htmlFor={fieldId} className="block text-label font-medium text-[--color-text-primary] mb-1.5">
            {label}
            {required && <span className="ml-1 text-[--color-danger]">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(
            "flex w-full rounded-md border px-3 py-2.5 text-sm transition-colors resize-none",
            "bg-[--color-surface] text-[--color-text-primary] placeholder:text-[--color-text-disabled]",
            "border-[--color-border] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-[--color-danger] focus:ring-[--color-danger]/20",
            className
          )}
          {...props}
        />
        {hint && !error && <p className="mt-1 text-small text-[--color-text-secondary]">{hint}</p>}
        {error && <p className="mt-1 text-small text-[--color-danger]" role="alert">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
