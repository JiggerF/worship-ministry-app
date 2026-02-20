import type { MemberWithRoles } from "@/lib/types/database";

export const INITIAL_MEMBERS: MemberWithRoles[] = [
  {
    id: "m1",
    name: "John Moore",
    email: "john@example.com",
    phone: "+61400111222",
    app_role: "Musician",
    magic_token: "tok-001",
    is_active: true,
    created_at: "",
    roles: ["worship_lead"],
  },
  {
    id: "m2",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    phone: null,
    app_role: "Musician",
    magic_token: "tok-002",
    is_active: true,
    created_at: "",
    roles: ["backup_vocals_1", "backup_vocals_2"],
  },
  {
    id: "m3",
    name: "David Chen",
    email: "david@example.com",
    phone: "+61400333444",
    app_role: "Musician",
    magic_token: "tok-003",
    is_active: true,
    created_at: "",
    roles: ["acoustic_guitar", "keyboard", "drums"],
  },
];
