import * as React from "react";
import { cn } from "./utils";

function Button({ className, children, ...props }: React.ComponentProps<"button">) {
  return (
    <button data-slot="button" className={cn("inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium", className)} {...props}>
      {children}
    </button>
  );
}

export { Button };
