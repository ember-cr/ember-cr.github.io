import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&>*]:relative [&>*]:z-[1]",
  {
    variants: {
      variant: {
        default: "glass-3d-tint glass-3d",
        destructive:
          "glass-3d text-destructive-foreground [background:linear-gradient(180deg,hsl(0_0%_100%/0.35)_0%,hsl(0_0%_100%/0.05)_50%,hsl(0_0%_0%/0.10)_100%),linear-gradient(135deg,hsl(var(--destructive)/0.9),hsl(var(--destructive)/0.75))]",
        outline: "glass-3d text-foreground",
        secondary: "glass-3d text-secondary-foreground",
        ghost: "hover:bg-accent/40 hover:text-accent-foreground transition-colors rounded-md",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "glass-3d-tint glass-3d shadow-glow",
        soft: "glass-3d text-foreground",
        glass: "glass-3d text-foreground",
        "glass-tint": "glass-3d-tint glass-3d",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        xl: "h-14 rounded-2xl px-10 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
