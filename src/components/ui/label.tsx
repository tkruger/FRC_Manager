import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-label font-medium text-[--color-text-primary] mb-1.5",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-[--color-danger]" aria-hidden="true">*</span>
      )}
    </label>
  )
);
Label.displayName = "Label";

export { Label };
