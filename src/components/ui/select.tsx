import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, required, placeholder, options, ...props }, ref) => {
    const fieldId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col">
        {label && (
          <label htmlFor={fieldId} className="block text-sm font-medium text-[--color-text-primary] mb-1.5">
            {label}
            {required && <span className="ml-1 text-[--color-danger]" aria-hidden>*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={fieldId}
          className={cn(
            // h-11 matches input height; bg explicit so dropdown list inherits theme
            "flex h-11 w-full rounded-md border px-3 py-2.5 text-sm transition-colors",
            "bg-[--color-surface] text-[--color-text-primary]",
            "border-[--color-border] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-[--color-danger] focus:ring-[--color-danger]/20",
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {hint && !error && <p className="mt-1 text-small text-[--color-text-secondary]">{hint}</p>}
        {error && <p className="mt-1 text-small text-[--color-danger]" role="alert">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
