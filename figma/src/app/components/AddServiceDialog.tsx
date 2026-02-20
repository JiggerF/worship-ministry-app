import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";

interface TeamMember {
  id: string;
  name: string;
  roles: string[];
  email?: string;
  phone?: string;
}

interface AddServiceDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (service: any) => void;
  teamMembers: TeamMember[];
  existingService?: any;
}

export function AddServiceDialog({ open, onClose, onSave, teamMembers, existingService }: AddServiceDialogProps) {
  const [date, setDate] = useState(existingService?.date || "");
  const [time, setTime] = useState(existingService?.time || "");
  const [type, setType] = useState(existingService?.type || "Sunday Service");
  const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>(
    existingService?.team.reduce((acc: any, member: any) => {
      acc[member.id] = member.role;
      return acc;
    }, {}) || {}
  );

  const handleSave = () => {
    const team = Object.entries(selectedMembers).map(([memberId, role]) => {
      const member = teamMembers.find(m => m.id === memberId);
      return {
        id: memberId,
        name: member?.name || "",
        role: role as string,
      };
    });

    onSave({
      id: existingService?.id || Date.now().toString(),
      date,
      time,
      type,
      team,
    });

    onClose();
  };

  const toggleMember = (memberId: string, checked: boolean) => {
    if (checked) {
      const member = teamMembers.find(m => m.id === memberId);
      setSelectedMembers(prev => ({
        ...prev,
        [memberId]: member?.roles[0] || "Team Member"
      }));
    } else {
      setSelectedMembers(prev => {
        const updated = { ...prev };
        delete updated[memberId];
        return updated;
      });
    }
  };

  const updateMemberRole = (memberId: string, role: string) => {
    setSelectedMembers(prev => ({
      ...prev,
      [memberId]: role
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingService ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Service Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sunday Service">Sunday Service</SelectItem>
                <SelectItem value="Wednesday Prayer">Wednesday Prayer</SelectItem>
                <SelectItem value="Youth Service">Youth Service</SelectItem>
                <SelectItem value="Special Event">Special Event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Team Members</Label>
            <div className="space-y-3 max-h-64 overflow-y-auto border rounded-md p-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`member-${member.id}`}
                      checked={!!selectedMembers[member.id]}
                      onCheckedChange={(checked) => toggleMember(member.id, checked as boolean)}
                    />
                    <Label htmlFor={`member-${member.id}`} className="flex-1 cursor-pointer">
                      {member.name}
                    </Label>
                  </div>
                  {selectedMembers[member.id] && (
                    <div className="ml-6">
                      <Select
                        value={selectedMembers[member.id]}
                        onValueChange={(role) => updateMemberRole(member.id, role)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {member.roles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={!date || !time}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
