import {
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  CalendarCheck,
  CalendarMinus,
  Gauge,
  CalendarClock,
  Megaphone,
  FileBarChart,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  /** Optional per-role label override. */
  labels?: Partial<Record<Role, string>>;
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "hod", "faculty"] }],
  },
  {
    label: "Academics",
    items: [
      { title: "Faculty", href: "/faculty", icon: Users, roles: ["admin", "hod"], labels: { hod: "Department Faculty" } },
      { title: "Departments", href: "/departments", icon: Building2, roles: ["admin", "hod"], labels: { hod: "My Department" } },
      { title: "Subjects & Courses", href: "/subjects", icon: BookOpen, roles: ["admin", "hod", "faculty"], labels: { faculty: "My Subjects" } },
      { title: "Timetable", href: "/timetable", icon: CalendarClock, roles: ["admin", "hod", "faculty"], labels: { faculty: "My Timetable" } },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Attendance", href: "/attendance", icon: CalendarCheck, roles: ["admin", "hod", "faculty"], labels: { faculty: "My Attendance" } },
      { title: "Leave Management", href: "/leaves", icon: CalendarMinus, roles: ["admin", "hod", "faculty"], labels: { faculty: "My Leave" } },
      { title: "Workload", href: "/workload", icon: Gauge, roles: ["admin", "hod", "faculty"], labels: { faculty: "My Workload" } },
      { title: "Announcements", href: "/announcements", icon: Megaphone, roles: ["admin", "hod", "faculty"] },
    ],
  },
  {
    label: "Insights & Admin",
    items: [
      { title: "Reports & Analytics", href: "/reports", icon: FileBarChart, roles: ["admin", "hod", "faculty"], labels: { faculty: "My Reports" } },
      { title: "Audit Logs", href: "/audit-logs", icon: ShieldCheck, roles: ["admin"] },
      { title: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

/** Route prefixes and the roles allowed to open them (frontend guard; the API enforces too). */
export const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/faculty", roles: ["admin", "hod"] },
  { prefix: "/departments", roles: ["admin", "hod"] },
  { prefix: "/audit-logs", roles: ["admin"] },
  { prefix: "/settings", roles: ["admin"] },
];

export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  faculty: "Faculty",
  departments: "Departments",
  subjects: "Subjects & Courses",
  attendance: "Attendance",
  leaves: "Leave Management",
  workload: "Workload",
  timetable: "Timetable",
  announcements: "Announcements",
  reports: "Reports & Analytics",
  "audit-logs": "Audit Logs",
  settings: "Settings",
  notifications: "Notifications",
  profile: "My Profile",
  new: "New",
  edit: "Edit",
};

export const ROLE_LABELS: Record<Role, string> = { admin: "Administrator", hod: "Head of Department", faculty: "Faculty" };
