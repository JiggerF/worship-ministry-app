import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { User } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  roles: string[];
  email?: string;
  phone?: string;
}

interface TeamMemberCardProps {
  member: TeamMember;
  onClick: () => void;
}

export function TeamMemberCard({ member, onClick }: TeamMemberCardProps) {
  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{member.name}</h4>
            {member.email && (
              <p className="text-sm text-muted-foreground truncate">{member.email}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {member.roles.map((role) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
