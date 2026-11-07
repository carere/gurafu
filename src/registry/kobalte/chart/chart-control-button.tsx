import { cva, type VariantProps } from "class-variance-authority";
import { type JSX, splitProps } from "solid-js";
import { cn } from "./chart-control-utils";

const buttonVariants = cva(
  "group/button z-button inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "z-button-variant-default",
        outline: "z-button-variant-outline",
        secondary: "z-button-variant-secondary",
        ghost: "z-button-variant-ghost",
        destructive: "z-button-variant-destructive",
        link: "z-button-variant-link",
      },
      size: {
        default: "z-button-size-default",
        xs: "z-button-size-xs",
        sm: "z-button-size-sm",
        lg: "z-button-size-lg",
        icon: "z-button-size-icon",
        "icon-xs": "z-button-size-icon-xs",
        "icon-sm": "z-button-size-icon-sm",
        "icon-lg": "z-button-size-icon-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Adapted from Gurafu's Zaidan button. Native buttons provide the keyboard and
// disabled semantics needed here, without pulling unrelated polymorphic types.
type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;
const Button = (props: ButtonProps) => {
  const [local, others] = splitProps(props, ["variant", "size", "class"]);
  return (
    <button
      type="button"
      class={cn(
        buttonVariants({ variant: local.variant, size: local.size }),
        "gap-2 rounded-md px-2 py-1 aria-pressed:bg-accent aria-pressed:font-semibold focus-visible:outline-2 focus-visible:outline-offset-2",
        local.class,
      )}
      {...others}
    />
  );
};

export { Button };
