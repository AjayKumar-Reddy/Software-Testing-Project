"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, GraduationCap, History, Mail, MapPin, Pencil, Phone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, TableSkeleton } from "@/components/shared/states";
import { ExportMenu } from "@/components/shared/export-menu";
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { PhotoUpload } from "./photo-upload";
import { get, getPage } from "@/lib/api";
import { formatDate, pct, titleCase } from "@/lib/utils";
import type { AttendanceStats, Faculty, LeaveApplication, LeaveBalance, Workload } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";

export interface FacultyDetail extends Faculty {
  reportingHead: { _id: string; fullName: string; designation: string; email: string; facultyId: string } | null;
  stats: {
    subjects: { _id: string; name: string; code: string; semester: number; credits: number; type: string }[];
    weeklyHours: number;
    attendance: AttendanceStats;
    leaveBalance: LeaveBalance[];
  };
}

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export function FacultyProfile({ faculty, canEdit, selfView = false }: { faculty: FacultyDetail; canEdit: boolean; selfView?: boolean }) {
  const history = useQuery({
    queryKey: ["faculty", faculty._id, "history"],
    queryFn: () => get<{ academicYear: string; totalHours: number; items: Workload[] }[]>(`/faculty/${selfView ? "me" : faculty._id}/teaching-history`),
  });
  const leaves = useQuery({
    queryKey: ["leaves", "faculty", faculty._id],
    queryFn: () => getPage<LeaveApplication>("/leaves", selfView ? { mine: "true", limit: 20 } : { faculty: faculty._id, limit: 20 }),
  });
  const addr = [faculty.address?.line1, faculty.address?.city, faculty.address?.state, faculty.address?.postalCode, faculty.address?.country].filter(Boolean).join(", ");
  const s = faculty.stats;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="h-28 bg-gradient-to-r from-[#172554] via-[#1e40af] to-[#2563eb]" />
        <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end">
          <PhotoUpload facultyId={faculty._id} name={faculty.fullName} photo={faculty.photo} editable={canEdit || selfView} className="-mt-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-2xl font-bold">{faculty.fullName}</h2>
              <StatusBadge status={faculty.isArchived ? "archived" : faculty.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {faculty.designation} · {faculty.department?.name} · <span className="font-mono">{faculty.facultyId}</span>
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <ExportMenu report="attendance" params={{ faculty: selfView ? undefined : faculty._id }} label="Attendance report" />
            {canEdit && !faculty.isArchived && (
              <Button render={<Link href={selfView ? "/profile?tab=edit" : `/faculty/${faculty._id}/edit`} />}>
                <Pencil className="size-4" /> Edit profile
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t sm:grid-cols-4">
          {[
            { label: "Attendance (all time)", value: pct(s.attendance.percentage) },
            { label: "Weekly teaching hours", value: s.weeklyHours },
            { label: "Subjects this year", value: s.subjects.length },
            { label: "Experience", value: `${faculty.experienceYears ?? 0} yrs` },
          ].map((x) => (
            <div key={x.label} className="border-r px-6 py-4 last:border-0 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r">
              <p className="font-heading text-xl font-bold tabular">{x.value}</p>
              <p className="text-xs text-muted-foreground">{x.label}</p>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="no-print">
          <TabsTrigger value="overview" className="px-3">Overview</TabsTrigger>
          <TabsTrigger value="history" className="px-3">Teaching history</TabsTrigger>
          <TabsTrigger value="attendance" className="px-3">Attendance</TabsTrigger>
          <TabsTrigger value="leave" className="px-3">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard title="Contact information">
              <div className="space-y-4">
                <Info icon={Mail} label="Email" value={faculty.email} />
                <Info icon={Phone} label="Phone" value={faculty.phone} />
                <Info icon={MapPin} label="Address" value={addr} />
                <Info icon={ShieldAlert} label="Emergency contact" value={faculty.emergencyContact?.name ? `${faculty.emergencyContact.name} (${faculty.emergencyContact.relation || "—"}) · ${faculty.emergencyContact.phone || ""}` : undefined} />
              </div>
            </SectionCard>
            <SectionCard title="Professional details" className="xl:col-span-2">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field label="Department" value={faculty.department?.name} />
                <Field label="Designation" value={faculty.designation} />
                <Field label="Employment type" value={titleCase(faculty.employmentType)} />
                <Field label="Qualification" value={faculty.qualification} />
                <Field label="Specialization" value={faculty.specialization} />
                <Field label="Date of joining" value={formatDate(faculty.dateOfJoining)} />
                <Field label="Gender" value={titleCase(faculty.gender)} />
                <Field label="Date of birth" value={faculty.dateOfBirth ? formatDate(faculty.dateOfBirth) : undefined} />
                <Field label="Courses" value={faculty.courses?.map((c) => c.code).join(", ")} />
              </dl>
              <div className="mt-6 rounded-lg border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Reporting department head</p>
                {faculty.reportingHead ? (
                  <div className="flex items-center gap-3">
                    <UserAvatar name={faculty.reportingHead.fullName} />
                    <div>
                      <p className="text-sm font-medium">{faculty.reportingHead.fullName}</p>
                      <p className="text-xs text-muted-foreground">{faculty.reportingHead.designation} · {faculty.reportingHead.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{faculty.department?.head === faculty._id ? "This faculty member is the head of the department." : "No head assigned."}</p>
                )}
              </div>
            </SectionCard>
            <SectionCard title="Assigned subjects" bodyClassName="p-0">
              {!s.subjects.length ? (
                <EmptyState icon={BookOpen} title="No subjects assigned this year" className="py-8" />
              ) : (
                <ul className="divide-y">
                  {s.subjects.map((sub) => (
                    <li key={sub._id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium">{sub.name}</p>
                        <p className="text-xs text-muted-foreground">{sub.code} · Sem {sub.semester} · {sub.credits} credits</p>
                      </div>
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] capitalize">{sub.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Leave balance" className="xl:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {s.leaveBalance.map((b) => (
                  <div key={b.type} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{titleCase(b.type)}</span>
                      <span className="text-xs text-muted-foreground"><b className="text-foreground">{b.available}</b> of {b.allocated} available</span>
                    </div>
                    <Progress value={b.allocated ? (b.used / b.allocated) * 100 : 0} className="h-1.5" />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{b.used} used{b.pending ? ` · ${b.pending} pending` : ""}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <SectionCard title="Teaching history" description="Workload allocations across academic years" bodyClassName="p-0">
            {history.isLoading ? (
              <TableSkeleton />
            ) : !history.data?.length ? (
              <EmptyState icon={History} title="No teaching history yet" />
            ) : (
              <div className="divide-y">
                {history.data.map((y) => (
                  <div key={y.academicYear} className="px-5 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="flex items-center gap-2 font-heading text-sm font-semibold"><GraduationCap className="size-4 text-blue-500" /> {y.academicYear}</p>
                      <span className="text-xs text-muted-foreground">{y.items.length} allocation(s) · {y.totalHours} hrs/week</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {y.items.map((w) => (
                        <div key={w._id} className="rounded-lg border p-3">
                          <p className="text-sm font-medium">{w.subject?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {w.subject?.code} · Sem {w.semester} · Sec {w.section} · {titleCase(w.type)} · {w.weeklyHours} hrs
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <SectionCard title="Attendance calendar" description="Hover a day for check-in details">
            <AttendanceCalendar facultyId={selfView ? undefined : faculty._id} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <SectionCard title="Leave history" bodyClassName="p-0">
            {leaves.isLoading ? (
              <TableSkeleton />
            ) : !leaves.data?.items.length ? (
              <EmptyState icon={CalendarDays} title="No leave applications" />
            ) : (
              <ul className="divide-y">
                {leaves.data.items.map((l) => (
                  <li key={l._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{titleCase(l.leaveType)} leave · {l.days} day{l.days > 1 ? "s" : ""}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(l.startDate)} – {formatDate(l.endDate)} · {l.reason}</p>
                      {l.reviewRemarks && <p className="text-xs text-muted-foreground italic">“{l.reviewRemarks}” — {l.reviewedBy?.name}</p>}
                    </div>
                    <StatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

