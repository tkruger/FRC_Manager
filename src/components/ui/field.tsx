import { cn } from "@/lib/utils";
import { Label } from "./label";
import { Input } from "./input";
import { forwardRef } from "react";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, hint, id, required, className, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className={cn("flex flex-col", className)}>
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
        <Input ref={ref} id={fieldId} error={error} required={required} {...props} />
        {hint && !error && (
          <p className="mt-1 text-small text-[--color-text-secondary]">{hint}</p>
        )}
        {error && (
          <p className="mt-1 text-small text-[--color-danger]" role="alert">{error}</p>
        )}
      </div>
    );
  }
);
Field.displayName = "Field";

export { Field };
