"use client";

import { useAuth } from "@/contexts/auth-context";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { FacultyDashboard } from "@/components/dashboard/faculty-dashboard";

export default function DashboardPage() {
  const { role } = useAuth();
  return role === "faculty" ? <FacultyDashboard /> : <AdminDashboard />;
}
