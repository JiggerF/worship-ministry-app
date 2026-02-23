/* eslint-disable */
import { Calendar, Clock, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

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

interface ServiceDetailsProps {
  service: Service | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function ServiceDetails({ service, open, onClose, onEdit }: ServiceDetailsProps) {
  if (!service) return null;

  const date = new Date(service.date);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Group team members by role
  const roleGroups = service.team.reduce((acc, member) => {
    if (!acc[member.role]) {
      acc[member.role] = [];
    }
    acc[member.role].push(member);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{service.type}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-4" />
              <span className="text-sm">{dateStr}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4" />
              <span className="text-sm">{service.time}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Team Roster</h4>
            {Object.entries(roleGroups).map(([role, members]) => (
              <div key={role} className="space-y-1">
                <div className="text-sm text-muted-foreground">{role}</div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((member) => (
                    <Badge key={member.id} variant="secondary">
                      {member.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button onClick={onEdit} className="w-full">
            Edit Roster
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
