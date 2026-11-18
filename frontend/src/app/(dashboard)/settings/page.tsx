"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Briefcase, Building, CalendarCog, CalendarRange, Clock, Gauge, Plane, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { useSettings } from "@/hooks/use-settings";
import { cn, formatDateTime } from "@/lib/utils";
import { AcademicSettings, AttendanceSettings, CalendarSettings, DesignationSettings, InstitutionSettings, LeaveSettings, NotificationSettings, WorkloadSettings } from "@/components/settings/sections";
import { UsersSection } from "@/components/settings/users-section";

const TABS = [
  { id: "institution", label: "Institution", icon: Building },
  { id: "academic", label: "Academic sessions", icon: CalendarRange },
  { id: "attendance", label: "Attendance rules", icon: Clock },
  { id: "leave", label: "Leave policy", icon: Plane },
  { id: "workload", label: "Workload limits", icon: Gauge },
  { id: "calendar", label: "Working days & slots", icon: CalendarCog },
  { id: "designations", label: "Designations", icon: Briefcase },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "users", label: "User accounts", icon: Users },
];

function SettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = TABS.find((t) => t.id === params.get("tab"))?.id ?? "institution";
  const { data: settings, isLoading, error, refetch } = useSettings();

  return (
    <div>
      <PageHeader title="Settings" description={settings?.updatedAt ? `Institution-wide configuration · last updated ${formatDateTime(settings.updatedAt)}` : "Institution-wide configuration"} />
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => router.replace(`/settings?tab=${t.id}`)}
              className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition", tab === t.id ? "bg-card text-foreground shadow-card ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading || !settings ? <TableSkeleton /> : (
            <div key={`${tab}-${settings.updatedAt}`}>
              {tab === "institution" && <InstitutionSettings settings={settings} />}
              {tab === "academic" && <AcademicSettings settings={settings} />}
              {tab === "attendance" && <AttendanceSettings settings={settings} />}
              {tab === "leave" && <LeaveSettings settings={settings} />}
              {tab === "workload" && <WorkloadSettings settings={settings} />}
              {tab === "calendar" && <CalendarSettings settings={settings} />}
              {tab === "designations" && <DesignationSettings settings={settings} />}
              {tab === "notifications" && <NotificationSettings settings={settings} />}
              {tab === "users" && <UsersSection />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
