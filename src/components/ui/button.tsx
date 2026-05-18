"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, useState } from "react";

// Base (resting) styles per variant
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

// Hover → always transitions to secondary (blue) so hover intent is clear
const HOVER_STYLE: React.CSSProperties = {
  background: "linear-gradient(160deg, color-mix(in srgb, var(--color-secondary) 90%, white 10%) 0%, var(--color-secondary) 100%)",
  color: "#ffffff",
  boxShadow: "0 2px 12px -2px color-mix(in srgb, var(--color-secondary) 55%, transparent), inset 0 1px 0 rgb(255 255 255 / .15)",
};

// For outline/ghost buttons — hover tints with the secondary colour
const OUTLINE_HOVER_STYLE: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--color-secondary) 10%, transparent)",
  borderColor: "color-mix(in srgb, var(--color-secondary) 60%, transparent)",
  color: "var(--color-secondary)",
};

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:   "focus-visible:ring-[--color-secondary]",
        secondary: "focus-visible:ring-[--color-secondary]",
        danger:    "focus-visible:ring-[--color-secondary]",
        outline:   "border border-[--color-border] bg-[--color-surface] text-[--color-text-primary]",
        ghost:     "bg-transparent text-[--color-text-primary]",
      },
      size: {
        sm:   "h-9 px-3 text-sm",
        md:   "h-10 px-4 text-sm",
        lg:   "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, style,
     onMouseEnter, onMouseLeave, ...props }, ref) => {
    const [hovered, setHovered] = useState(false);
    const v = variant ?? "primary";

    // Build inline style based on variant + hover state
    let inlineStyle: React.CSSProperties = {};
    if (v === "primary" || v === "secondary" || v === "danger") {
      inlineStyle = hovered ? HOVER_STYLE : (VARIANT_STYLES[v] ?? {});
    } else if ((v === "outline" || v === "ghost") && hovered) {
      inlineStyle = OUTLINE_HOVER_STYLE;
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        style={{ ...inlineStyle, ...style }}
        disabled={disabled || isLoading}
        onMouseEnter={(e) => { setHovered(true);  onMouseEnter?.(e); }}
        onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e); }}
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
