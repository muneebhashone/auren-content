import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-bg-overlay text-fg-muted border border-border",
        accent: "bg-accent/10 text-accent border border-accent/30",
        x: "bg-fg/5 text-fg border border-fg/20",
        linkedin: "bg-linkedin/10 text-linkedin border border-linkedin/30",
        warning: "bg-warning/10 text-warning border border-warning/30",
        danger: "bg-danger/10 text-danger border border-danger/30",
        muted: "bg-bg-overlay text-fg-subtle border border-border",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
