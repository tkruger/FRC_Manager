import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

// Inline style maps for colored variants — guarantees CSS variable resolution
// in both light and dark mode regardless of Tailwind class scanning.
const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary:   { backgroundColor: "var(--color-primary)",   color: "#ffffff" },
  secondary: { backgroundColor: "var(--color-secondary)", color: "#ffffff" },
  danger:    { backgroundColor: "var(--color-danger)",    color: "#ffffff" },
};

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        // background/color set via inline style — class only adds hover/focus
        primary:
          "hover:opacity-85 active:opacity-75 focus-visible:ring-[--color-primary]",
        secondary:
          "hover:opacity-85 active:opacity-75 focus-visible:ring-[--color-secondary]",
        danger:
          "hover:opacity-85 active:opacity-75 focus-visible:ring-[--color-danger]",
        // outline/ghost — no inline bg needed
        outline:
          "border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] hover:bg-[--color-surface-overlay] active:bg-[--color-surface-overlay]",
        ghost:
          "bg-transparent text-[--color-text-primary] hover:bg-[--color-surface-overlay]",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, style, ...props }, ref) => {
    const variantStyle = VARIANT_STYLES[variant ?? "primary"] ?? {};
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        style={{ ...variantStyle, ...style }}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
