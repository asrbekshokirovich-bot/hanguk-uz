import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        highlight: "border-transparent bg-accent text-accent-foreground hover:bg-accent/80 font-semibold",
        success: "border-transparent bg-success text-success-foreground hover:bg-success/80",
        /* Soft tonal badges (redesign) — tinted bg + colored text, for
           stage / payment / priority / status chips across the CRM. */
        successSoft: "border-transparent bg-success/10 text-success",
        destructiveSoft: "border-transparent bg-destructive/10 text-destructive",
        warning: "border-transparent bg-warning/10 text-warning",
        info: "border-transparent bg-info/10 text-info",
        lime: "border-transparent bg-accent/15 text-accent-foreground",
        neutral: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

// Problem 5: Wrap with forwardRef to fix console ref warning in Radix components
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
