import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-border-strong disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;utf8,<svg fill=%22%23a1a1ad%22 height=%2210%22 viewBox=%220 0 10 6%22 width=%2210%22 xmlns=%22http://www.w3.org/2000/svg%22><path d=%22M0 0l5 6 5-6z%22/></svg>')] bg-no-repeat bg-[right_12px_center] pr-9 [color-scheme:dark] [&>option]:bg-bg-elevated [&>option]:text-fg",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
