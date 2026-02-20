import * as React from "react";
import { cn } from "./utils";

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span data-slot="badge" className={cn("inline-block px-2 py-1 rounded-full text-xs bg-green-600 text-white", className)}>{children}</span>;
}

export { Badge };
