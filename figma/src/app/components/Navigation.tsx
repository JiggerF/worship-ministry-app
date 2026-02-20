import { Link, useLocation } from "react-router";
import { Calendar, Music } from "lucide-react";

export function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card">
      <div className="flex">
        <Link
          to="/"
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
            location.pathname === "/" 
              ? "text-primary" 
              : "text-muted-foreground"
          }`}
        >
          <Calendar className="size-5" />
          <span>Roster</span>
        </Link>
        
        <Link
          to="/songs"
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
            location.pathname === "/songs" 
              ? "text-primary" 
              : "text-muted-foreground"
          }`}
        >
          <Music className="size-5" />
          <span>Songs</span>
        </Link>
      </div>
    </nav>
  );
}
