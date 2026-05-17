import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

// Inline styles guarantee CSS variable resolution in both modes.
// Gradient + shadow glow adds depth and makes buttons "pop".
const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(160deg, color-mix(in srgb, var(--color-primary) 90%, white 10%) 0%, var(--color-primary) 100%)",
    color: "#ffffff",
    boxShadow: "0 2px 8px -2px color-mix(in srgb, var(--color-primary) 50%, transparent), inset 0 1px 0 rgb(255 255 255 / .12)",
  },
  secondary: {
    background: "linear-gradient(160deg, color-mix(in srgb, var(--color-secondary) 90%, white 10%) 0%, var(--color-secondary) 100%)",
    color: "#ffffff",
    boxShadow: "0 2px 8px -2px color-mix(in srgb, var(--color-secondary) 50%, transparent), inset 0 1px 0 rgb(255 255 255 / .12)",
  },
  danger: {
    background: "linear-gradient(160deg, color-mix(in srgb, var(--color-danger) 90%, white 10%) 0%, var(--color-danger) 100%)",
    color: "#ffffff",
    boxShadow: "0 2px 8px -2px color-mix(in srgb, var(--color-danger) 50%, transparent), inset 0 1px 0 rgb(255 255 255 / .12)",
  },
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
