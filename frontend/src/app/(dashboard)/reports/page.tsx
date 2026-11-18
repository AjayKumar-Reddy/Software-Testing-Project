"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, startOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Briefcase, Building2, CalendarCheck, CalendarMinus, FileBarChart, Gauge, Printer, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { ExportMenu } from "@/components/shared/export-menu";
import { ChartSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states";
import { BarChartView, DonutChart } from "@/components/charts/charts";
import { useDepartments, useFacultyOptions } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/auth-context";
import { get } from "@/lib/api";
import { EMPLOYMENT_STATUSES, LEAVE_STATUSES } from "@/lib/constants";
import { cn, todayInput } from "@/lib/utils";
import type { ReportData, Role } from "@/types";

interface ReportDef {
  type: string;
  title: string;
  description: string;
  icon: LucideIcon;
  roles: Role[];
  filters: ("dateRange" | "department" | "faculty" | "status" | "year" | "term")[];
  statusOptions?: { value: string; label: string }[];
}

const REPORTS: ReportDef[] = [
  { type: "faculty-directory", title: "Faculty directory", description: "Complete list of faculty with contact and employment details", icon: Users, roles: ["admin", "hod"], filters: ["department", "status"], statusOptions: EMPLOYMENT_STATUSES },
  { type: "department-summary", title: "Department-wise faculty", description: "Strength, subjects, workload and attendance by department", icon: Building2, roles: ["admin", "hod"], filters: ["department", "year", "dateRange"] },
  { type: "attendance", title: "Attendance report", description: "Present, late, absent and leave days with attendance %", icon: CalendarCheck, roles: ["admin", "hod", "faculty"], filters: ["dateRange", "department", "faculty"] },
  { type: "leave", title: "Leave report", description: "Leave applications by type, status and reviewer", icon: CalendarMinus, roles: ["admin", "hod", "faculty"], filters: ["dateRange", "department", "faculty", "status"], statusOptions: LEAVE_STATUSES },
  { type: "workload", title: "Workload report", description: "Weekly teaching hours and load status per faculty", icon: Gauge, roles: ["admin", "hod", "faculty"], filters: ["year", "term", "department", "faculty", "status"], statusOptions: [{ value: "overloaded", label: "Overloaded" }, { value: "optimal", label: "Optimal" }, { value: "underutilized", label: "Underutilized" }] },
  { type: "subject-allocation", title: "Subject allocation", description: "Subjects with their assigned faculty and allocated hours", icon: BookOpen, roles: ["admin", "hod"], filters: ["year", "department", "faculty"] },
  { type: "employment-status", title: "Employment status", description: "Faculty by employment status and type in each department", icon: Briefcase, roles: ["admin", "hod"], filters: ["department"] },
];

function ReportsInner() {
  const { role } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const { data: settings } = useSettings();
  const { data: departments } = useDepartments();
  const { data: facultyOpts } = useFacultyOptions();
  const available = REPORTS.filter((r) => role && r.roles.includes(role));
  const def = available.find((r) => r.type === params.get("type")) ?? available[0];
  const isStaff = role !== "faculty";

  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(todayInput());
  const [department, setDepartment] = useState("");
  const [faculty, setFaculty] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");
  const [term, setTerm] = useState("all");

  const has = (f: ReportDef["filters"][number]) => def?.filters.includes(f);
  const query = useMemo(
    () => ({
      from: has("dateRange") ? from : undefined,
      to: has("dateRange") ? to : undefined,
      department: has("department") && role === "admin" ? department : undefined,
      faculty: has("faculty") && isStaff ? faculty : undefined,
      status: has("status") ? status : undefined,
      academicYear: has("year") ? year || settings?.academicYear : undefined,
      term: has("term") ? term : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def, from, to, department, faculty, status, year, term, settings, role, isStaff],
  );
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["report", def?.type, query],
    queryFn: () => get<ReportData>(`/reports/${def!.type}`, query),
    enabled: !!def,
  });

  const select = (type: string) => {
    setStatus("");
    router.replace(`/reports?type=${type}`);
  };

  return (
    <div>
      <PageHeader
        title={isStaff ? "Reports & Analytics" : "My Reports"}
        description="Generate reports from live data, then download as PDF, Excel or CSV — or print."
        actions={
          def && (
            <>
              <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <ExportMenu report={def.type} params={query} label="Download" />
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <nav className="no-print space-y-1.5" aria-label="Report types">
          {available.map((r) => (
            <button
              key={r.type}
              type="button"
              onClick={() => select(r.type)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                def?.type === r.type ? "border-blue-300 bg-blue-50/70 shadow-card dark:border-blue-500/40 dark:bg-blue-500/10" : "bg-card hover:border-blue-200 hover:shadow-card",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", def?.type === r.type ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground")}><r.icon className="size-4" /></span>
              <span>
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{r.description}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {def && (
            <SectionCard className="no-print" bodyClassName="flex flex-wrap items-end gap-3">
              {has("dateRange") && (
                <>
                  <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="r-from">From</label><Input id="r-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" /></div>
                  <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="r-to">To</label><Input id="r-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" /></div>
                </>
              )}
              {has("year") && <div className="w-32 space-y-1"><span className="text-xs font-medium text-muted-foreground">Academic year</span><AppSelect value={year || settings?.academicYear || ""} onChange={setYear} options={["2024-25", "2025-26", "2026-27", "2027-28"].map((y) => ({ value: y, label: y }))} /></div>}
              {has("term") && <div className="w-32 space-y-1"><span className="text-xs font-medium text-muted-foreground">Semester</span><AppSelect value={term} onChange={setTerm} options={[{ value: "all", label: "Full year" }, { value: "odd", label: "Odd" }, { value: "even", label: "Even" }]} /></div>}
              {has("department") && role === "admin" && <div className="w-48 space-y-1"><span className="text-xs font-medium text-muted-foreground">Department</span><AppSelect value={department} onChange={setDepartment} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.name }))} /></div>}
              {has("faculty") && isStaff && <div className="w-56 space-y-1"><span className="text-xs font-medium text-muted-foreground">Faculty</span><Combobox value={faculty} onChange={setFaculty} clearable placeholder="All faculty" options={(facultyOpts ?? []).map((f) => ({ value: f._id, label: f.fullName, description: f.facultyId }))} /></div>}
              {has("status") && def.statusOptions && <div className="w-40 space-y-1"><span className="text-xs font-medium text-muted-foreground">Status</span><AppSelect value={status} onChange={setStatus} allLabel="Any status" options={def.statusOptions} /></div>}
            </SectionCard>
          )}

          {error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isLoading || !data ? (
            <><ChartSkeleton /><TableSkeleton /></>
          ) : (
            <div className={cn("space-y-6 transition-opacity", isFetching && "opacity-60")}>
              <div className="print-only mb-4">
                <h2 className="text-xl font-bold">{settings?.institutionName}</h2>
                <p className="text-sm">{data.title}{data.subtitle ? ` — ${data.subtitle}` : ""} · Generated {format(new Date(), "dd MMM yyyy, HH:mm")}</p>
              </div>
              {!!data.summary?.length && (
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {data.summary.map((s) => (
                    <div key={s.label} className="rounded-xl border bg-card p-4 shadow-card">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="mt-1 font-heading text-xl font-bold tabular">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {data.chart && data.chart.data.length > 0 && (
                <SectionCard title={`${data.title} — chart`}>
                  {data.chart.type === "pie" ? (
                    <DonutChart data={data.chart.data} nameKey={data.chart.xKey} valueKey={data.chart.series[0].key} height={280} />
                  ) : (
                    <BarChartView data={data.chart.data} xKey={data.chart.xKey} series={data.chart.series} height={300} unit={data.chart.series[0].key === "percentage" ? "%" : undefined} />
                  )}
                </SectionCard>
              )}
              <SectionCard title={data.title} description={`${data.subtitle ? `${data.subtitle} · ` : ""}${data.rows.length} row(s)`} bodyClassName="p-0">
                {!data.rows.length ? (
                  <EmptyState icon={FileBarChart} title="No data for these filters" description="Adjust the date range or filters." />
                ) : (
                  <div className="max-h-[640px] overflow-auto scrollbar-thin print:max-h-none">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          {data.columns.map((c) => <TableHead key={c.key} className="h-10 px-4 text-[11.5px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">{c.label}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.rows.map((r, i) => (
                          <TableRow key={i}>
                            {data.columns.map((c) => <TableCell key={c.key} className="px-4 py-2.5 text-[13px] whitespace-nowrap">{r[c.key] ?? "—"}</TableCell>)}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsInner />
    </Suspense>
  );
}
