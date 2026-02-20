import { Calendar, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

interface Service {
  id: string;
  date: string;
  time: string;
  type: string;
  team: TeamMember[];
}

interface ServiceCardProps {
  service: Service;
  onClick: () => void;
}

export function ServiceCard({ service, onClick }: ServiceCardProps) {
  const date = new Date(service.date);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{service.type}</CardTitle>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <Calendar className="size-4" />
              <span className="text-sm">{dayName}, {dateStr}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <Clock className="size-4" />
              <span className="text-sm">{service.time}</span>
            </div>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="size-3" />
            {service.team.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {service.team.slice(0, 3).map((member) => (
            <Badge key={member.id} variant="secondary" className="text-xs">
              {member.name}
            </Badge>
          ))}
          {service.team.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{service.team.length - 3} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
