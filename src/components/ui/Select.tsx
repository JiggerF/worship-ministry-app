"use client";

import * as React from "react";
import { cn } from "./utils";

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select data-slot="select" className={cn("w-full rounded-md border px-3 py-2 text-sm", className)} {...props}>
      {children}
    </select>
  );
}

export { Select };

