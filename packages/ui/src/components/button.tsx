import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:brightness-105 active:translate-y-px",
        soft: "bg-soft text-accent-foreground hover:brightness-[0.98] active:translate-y-px",
        outline: "border border-border bg-transparent hover:bg-muted text-foreground",
        ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive: "bg-destructive text-white shadow-sm hover:brightness-105",
      },
      size: {
        sm: "h-8 rounded-[var(--radius-sm)] px-3 text-[13px]",
        md: "h-9 rounded-[var(--radius-md)] px-4 text-sm",
        lg: "h-11 rounded-[var(--radius-lg)] px-6 text-base",
        pill: "h-9 rounded-pill px-4 text-sm",
        icon: "size-9 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
