import * as React from "react";
import { cn } from "./utils";

function Pagination({ page = 1, total = 1, onPrev, onNext, className, ...props }: { page?: number; total?: number; onPrev?: () => void; onNext?: () => void; className?: string } & React.ComponentProps<"nav">) {
  return (
    <nav role="navigation" aria-label="pagination" data-slot="pagination" className={cn("mx-auto flex items-center gap-3", className)} {...props}>
      <button onClick={onPrev} disabled={page <= 1} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
      <span className="text-sm">Page {page} / {total}</span>
      <button onClick={onNext} disabled={page >= total} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
    </nav>
  );
}

export { Pagination };

