/* eslint-disable */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (member: any) => void;
  existingMember?: any;
}

const AVAILABLE_ROLES = [
  "Worship Leader",
  "Vocals",
  "Guitar",
  "Bass",
  "Drums",
  "Keys",
  "Sound Tech",
  "Lights",
  "Video"
];

export function AddMemberDialog({ open, onClose, onSave, existingMember }: AddMemberDialogProps) {
  const [name, setName] = useState(existingMember?.name || "");
  const [email, setEmail] = useState(existingMember?.email || "");
  const [phone, setPhone] = useState(existingMember?.phone || "");
  const [roles, setRoles] = useState<string[]>(existingMember?.roles || []);

  const handleSave = () => {
    onSave({
      id: existingMember?.id || Date.now().toString(),
      name,
      email,
      phone,
      roles,
    });

    // Reset form
    setName("");
    setEmail("");
    setPhone("");
    setRoles([]);
    onClose();
  };

  const toggleRole = (role: string) => {
    setRoles(prev => 
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existingMember ? "Edit Member" : "Add Team Member"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(123) 456-7890"
            />
          </div>

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_ROLES.map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role}`}
                    checked={roles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <Label htmlFor={`role-${role}`} className="text-sm cursor-pointer">
                    {role}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={!name || roles.length === 0}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
