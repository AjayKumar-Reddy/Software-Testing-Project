"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ImageUp, Loader2, Mail, Plus, Save, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "@/components/shared/section-card";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useSaveSettings } from "./use-save-settings";
import { apiError, del, get, patch, post, put } from "@/lib/api";
import { WEEKDAYS } from "@/lib/constants";
import { assetUrl, formatDate, toInputDate } from "@/lib/utils";
import type { AcademicSession, SystemSettings, TimeSlot } from "@/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => ({ value: String(i + 1), label: m }));

function SaveBar({ onSave, saving, dirty = true }: { onSave: () => void; saving: boolean; dirty?: boolean }) {
  return (
    <div className="mt-6 flex justify-end border-t pt-4">
      <Button onClick={onSave} disabled={saving || !dirty}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes</Button>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3.5">
      <div><p className="text-sm font-medium">{label}</p>{description && <p className="text-xs text-muted-foreground">{description}</p>}</div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

export function InstitutionSettings({ settings }: { settings: SystemSettings }) {
  const save = useSaveSettings();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState({ institutionName: settings.institutionName, institutionShortName: settings.institutionShortName, address: settings.address ?? "", contactEmail: settings.contactEmail ?? "" });
  const logo = useMutation({
    mutationFn: (f: File) => { const fd = new FormData(); fd.append("logo", f); return post("/settings/logo", fd); },
    onSuccess: () => { toast.success("Logo updated"); qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["settings-public"] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <SectionCard title="Institution profile" description="Shown on the sign-in page, sidebar and generated reports.">
      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-32 items-center justify-center overflow-hidden rounded-2xl border bg-muted/40">
            {settings.institutionLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(settings.institutionLogo)} alt="Institution logo" className="size-full object-contain p-2" />
            ) : <ImageUp className="size-8 text-muted-foreground" />}
          </div>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={logo.isPending}>{logo.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />} Upload logo</Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) logo.mutate(f); e.target.value = ""; }} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Institution name" required className="sm:col-span-2"><Input value={v.institutionName} onChange={(e) => setV({ ...v, institutionName: e.target.value })} /></FormField>
          <FormField label="Short name"><Input value={v.institutionShortName} onChange={(e) => setV({ ...v, institutionShortName: e.target.value })} /></FormField>
          <FormField label="Contact email"><Input type="email" value={v.contactEmail} onChange={(e) => setV({ ...v, contactEmail: e.target.value })} /></FormField>
          <FormField label="Address" className="sm:col-span-2"><Textarea rows={2} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></FormField>
        </div>
      </div>
      <SaveBar onSave={() => (v.institutionName.trim().length < 2 ? toast.error("Institution name is required") : save.mutate(v))} saving={save.isPending} />
    </SectionCard>
  );
}

function SessionDialog({ session, onOpenChange }: { session: AcademicSession | null | undefined; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ name: "", startDate: "", endDate: "", oddStart: "", oddEnd: "", evenStart: "", evenEnd: "", isCurrent: false });
  useEffect(() => {
    if (session === undefined) return;
    const odd = session?.semesters.find((s) => s.name === "Odd");
    const even = session?.semesters.find((s) => s.name === "Even");
    setV({ name: session?.name ?? "", startDate: toInputDate(session?.startDate), endDate: toInputDate(session?.endDate), oddStart: toInputDate(odd?.startDate), oddEnd: toInputDate(odd?.endDate), evenStart: toInputDate(even?.startDate), evenEnd: toInputDate(even?.endDate), isCurrent: session?.isCurrent ?? false });
  }, [session]);
  const save = useMutation({
    mutationFn: () => {
      const semesters = [
        ...(v.oddStart && v.oddEnd ? [{ name: "Odd", startDate: v.oddStart, endDate: v.oddEnd }] : []),
        ...(v.evenStart && v.evenEnd ? [{ name: "Even", startDate: v.evenStart, endDate: v.evenEnd }] : []),
      ];
      const body = { name: v.name, startDate: v.startDate, endDate: v.endDate, isCurrent: v.isCurrent, semesters };
      return session ? put(`/sessions/${session._id}`, body) : post("/sessions", body);
    },
    onSuccess: (r) => { toast.success(r.message ?? "Saved"); qc.invalidateQueries({ queryKey: ["sessions"] }); qc.invalidateQueries({ queryKey: ["settings"] }); onOpenChange(false); },
    onError: (e) => toast.error(apiError(e)),
  });
  const valid = /^\d{4}-\d{2}$/.test(v.name) && v.startDate && v.endDate && v.endDate > v.startDate;
  return (
    <Dialog open={session !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{session ? `Edit ${session.name}` : "New academic session"}</DialogTitle><DialogDescription>Define the academic year and its semesters.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" hint="Format: 2027-28" error={v.name && !/^\d{4}-\d{2}$/.test(v.name) ? "Use the format 2027-28" : undefined} className="sm:col-span-2"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="2027-28" /></FormField>
          <FormField label="Start date"><Input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} /></FormField>
          <FormField label="End date" error={v.endDate && v.endDate <= v.startDate ? "Must be after start" : undefined}><Input type="date" value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} /></FormField>
          <FormField label="Odd semester start"><Input type="date" value={v.oddStart} onChange={(e) => setV({ ...v, oddStart: e.target.value })} /></FormField>
          <FormField label="Odd semester end"><Input type="date" value={v.oddEnd} onChange={(e) => setV({ ...v, oddEnd: e.target.value })} /></FormField>
          <FormField label="Even semester start"><Input type="date" value={v.evenStart} onChange={(e) => setV({ ...v, evenStart: e.target.value })} /></FormField>
          <FormField label="Even semester end"><Input type="date" value={v.evenEnd} onChange={(e) => setV({ ...v, evenEnd: e.target.value })} /></FormField>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={v.isCurrent} onCheckedChange={(c) => setV({ ...v, isCurrent: !!c })} /> Set as the current academic session</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} Save session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AcademicSettings({ settings }: { settings: SystemSettings }) {
  const save = useSaveSettings();
  const qc = useQueryClient();
  const [v, setV] = useState({ currentSemester: settings.currentSemester, oddStartMonth: String(settings.semesterConfig.oddStartMonth), evenStartMonth: String(settings.semesterConfig.evenStartMonth) });
  const [editing, setEditing] = useState<AcademicSession | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<AcademicSession | null>(null);
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => get<AcademicSession[]>("/sessions") });
  const act = useMutation({
    mutationFn: ({ s, kind }: { s: AcademicSession; kind: "current" | "delete" }) => (kind === "current" ? patch(`/sessions/${s._id}/current`) : del(`/sessions/${s._id}`)),
    onSuccess: (r) => { toast.success(r.message ?? "Done"); qc.invalidateQueries({ queryKey: ["sessions"] }); qc.invalidateQueries({ queryKey: ["settings"] }); setDeleting(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <div className="space-y-6">
      <SectionCard title="Academic calendar" description={`Current academic year: ${settings.academicYear} (set via sessions below)`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Current semester"><AppSelect value={v.currentSemester} onChange={(x) => setV({ ...v, currentSemester: x as "Odd" | "Even" })} options={[{ value: "Odd", label: "Odd semester" }, { value: "Even", label: "Even semester" }]} /></FormField>
          <FormField label="Odd semester starts in"><AppSelect value={v.oddStartMonth} onChange={(x) => setV({ ...v, oddStartMonth: x })} options={MONTHS} /></FormField>
          <FormField label="Even semester starts in"><AppSelect value={v.evenStartMonth} onChange={(x) => setV({ ...v, evenStartMonth: x })} options={MONTHS} /></FormField>
        </div>
        <SaveBar onSave={() => save.mutate({ currentSemester: v.currentSemester, semesterConfig: { oddStartMonth: Number(v.oddStartMonth), evenStartMonth: Number(v.evenStartMonth) } })} saving={save.isPending} />
      </SectionCard>
      <SectionCard title="Academic sessions" bodyClassName="p-0" actions={<Button size="sm" onClick={() => setEditing(null)}><Plus className="size-4" /> New session</Button>}>
        <DataTable
          data={sessions.data}
          loading={sessions.isLoading}
          error={sessions.error}
          rowKey={(s) => s._id}
          columns={[
            { key: "name", header: "Session", cell: (s) => <span className="flex items-center gap-2 font-semibold">{s.name}{s.isCurrent && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="size-3" />Current</span>}</span> },
            { key: "period", header: "Period", cell: (s) => `${formatDate(s.startDate)} – ${formatDate(s.endDate)}` },
            { key: "sems", header: "Semesters", cell: (s) => <span className="text-xs text-muted-foreground">{s.semesters.map((x) => `${x.name}: ${formatDate(x.startDate, "d MMM")} – ${formatDate(x.endDate, "d MMM yy")}`).join(" · ") || "—"}</span> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "text-right", cell: (s) => (
              <div className="flex justify-end gap-1">
                {!s.isCurrent && <Button variant="ghost" size="xs" onClick={() => act.mutate({ s, kind: "current" })}><Star className="size-3.5" /> Make current</Button>}
                <Button variant="ghost" size="xs" onClick={() => setEditing(s)}>Edit</Button>
                {!s.isCurrent && <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`}><Trash2 className="size-4 text-rose-500" /></Button>}
              </div>
            ) },
          ]}
        />
      </SectionCard>
      <SessionDialog session={editing} onOpenChange={(o) => !o && setEditing(undefined)} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete session ${deleting?.name}?`} description="Records already tagged with this academic year are kept." confirmLabel="Delete" destructive loading={act.isPending} onConfirm={() => deleting && act.mutate({ s: deleting, kind: "delete" })} />
    </div>
  );
}

export function AttendanceSettings({ settings }: { settings: SystemSettings }) {
  const save = useSaveSettings();
  const [v, setV] = useState(settings.attendance);
  const bad = v.workdayEnd <= v.workdayStart || v.lateAfter < v.workdayStart;
  return (
    <SectionCard title="Attendance rules" description="These rules control late marking and who may record attendance.">
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="Workday starts"><Input type="time" value={v.workdayStart} onChange={(e) => setV({ ...v, workdayStart: e.target.value })} /></FormField>
        <FormField label="Workday ends" error={v.workdayEnd <= v.workdayStart ? "Must be after start" : undefined}><Input type="time" value={v.workdayEnd} onChange={(e) => setV({ ...v, workdayEnd: e.target.value })} /></FormField>
        <FormField label="Marked late after" error={v.lateAfter < v.workdayStart ? "Must not be before start" : undefined}><Input type="time" value={v.lateAfter} onChange={(e) => setV({ ...v, lateAfter: e.target.value })} /></FormField>
        <FormField label="Minimum attendance %"><Input type="number" min={0} max={100} value={v.minAttendancePercent} onChange={(e) => setV({ ...v, minAttendancePercent: Number(e.target.value) })} /></FormField>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Toggle label="Allow faculty self check-in" description="Self check-ins are labelled “self-reported” and are not biometric or location-verified." checked={v.allowSelfCheckIn} onChange={(c) => setV({ ...v, allowSelfCheckIn: c })} />
        <Toggle label="Allow HODs to mark attendance" description="When off, only administrators can record attendance." checked={v.hodCanMark} onChange={(c) => setV({ ...v, hodCanMark: c })} />
      </div>
      <SaveBar onSave={() => save.mutate({ attendance: v })} saving={save.isPending} dirty={!bad} />
    </SectionCard>
  );
}

export function LeaveSettings({ settings }: { settings: SystemSettings }) {
  const save = useSaveSettings();
  const [v, setV] = useState(settings.leavePolicy);
  const types = [["casual", "Casual"], ["sick", "Sick"], ["earned", "Earned"], ["medical", "Medical"], ["other", "Other"]] as const;
  return (
    <SectionCard title="Leave policy" description="Annual allocations apply to balances created for new academic years. Existing balances can be adjusted per faculty on the Leave page.">
      <div className="grid gap-4 sm:grid-cols-5">
        {types.map(([k, l]) => (
          <FormField key={k} label={`${l} (days/yr)`}><Input type="number" min={0} max={365} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} /></FormField>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Maximum days per application"><Input type="number" min={1} max={365} value={v.maxConsecutiveDays} onChange={(e) => setV({ ...v, maxConsecutiveDays: Number(e.target.value) })} /></FormField>
        <FormField label="Allow back-dated applications up to (days)"><Input type="number" min={0} max={90} value={v.allowBackdatedDays} onChange={(e) => setV({ ...v, allowBackdatedDays: Number(e.target.value) })} /></FormField>
      </div>
      <SaveBar onSave={() => save.mutate({ leavePolicy: v })} saving={save.isPending} />
    </SectionCard>
  );
}

export function WorkloadSettings({ settings }: { settings: SystemSettings }) {
  const save = useSaveSettings();
  const [v, setV] = useState(settings.workload);
  const bad = v.maxWeeklyHours <= v.minWeeklyHours;
  return (
    <SectionCard title="Workload limits" description="Faculty below the minimum are flagged underutilized; above the maximum, overloaded.">
      <div className="grid max-w-lg gap-4 sm:grid-cols-2">
        <FormField label="Minimum weekly hours"><Input type="number" min={0} max={60} value={v.minWeeklyHours} onChange={(e) => setV({ ...v, minWeeklyHours: Number(e.target.value) })} /></FormField>
        <FormField label="Maximum weekly hours" error={bad ? "Must exceed the minimum" : undefined}><Input type="number" min={1} max={60} value={v.maxWeeklyHours} onChange={(e) => setV({ ...v, maxWeeklyHours: Number(e.target.value) })} /></FormField>
      </div>
      <SaveBar onSave={() => save.mutate({ workload: v })} saving={save.isPending} dirty={!bad} />
    </SectionCard>
  );
}

export function CalendarSettings({ settings }: { settings: SystemSettings }) {
  const save = useSaveSettings();
  const [days, setDays] = useState<number[]>(settings.workingDays);
  const [slots, setSlots] = useState<TimeSlot[]>(settings.timetableSlots);
  const invalid = slots.some((s) => !s.label || s.endTime <= s.startTime) || !days.length;
  return (
    <SectionCard title="Working days & time slots" description="Used for leave day calculations, attendance and the timetable grid.">
      <p className="mb-2 text-sm font-medium">Working days</p>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-500/10">
            <Checkbox checked={days.includes(d)} onCheckedChange={(c) => setDays(c ? [...days, d].sort() : days.filter((x) => x !== d))} /> {WEEKDAYS[d]}
          </label>
        ))}
      </div>
      <div className="mt-6 mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Timetable periods</p>
        <Button variant="outline" size="sm" onClick={() => setSlots([...slots, { label: `Period ${slots.length + 1}`, startTime: slots.at(-1)?.endTime ?? "09:00", endTime: "17:00" }])}><Plus className="size-4" /> Add period</Button>
      </div>
      <div className="space-y-2">
        {slots.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_120px_36px] items-center gap-2">
            <Input value={s.label} aria-label="Period label" onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input type="time" value={s.startTime} aria-label="Start" onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))} />
            <Input type="time" value={s.endTime} aria-label="End" aria-invalid={s.endTime <= s.startTime} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))} />
            <Button variant="ghost" size="icon-sm" onClick={() => setSlots(slots.filter((_, j) => j !== i))} disabled={slots.length <= 1} aria-label="Remove period"><X className="size-4" /></Button>
          </div>
        ))}
      </div>
      <SaveBar onSave={() => save.mutate({ workingDays: days, timetableSlots: [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime)) })} saving={save.isPending} dirty={!invalid} />
    </SectionCard>
  );
}

export function DesignationSettings({ settings }: { settings: SystemSettings }) {
  const save = useSaveSettings();
  const [list, setList] = useState(settings.designations);
  const [value, setValue] = useState("");
  const add = () => {
    const v = value.trim();
    if (v.length < 2) return;
    if (list.some((d) => d.toLowerCase() === v.toLowerCase())) return toast.error("Designation already exists");
    setList([...list, v]);
    setValue("");
  };
  return (
    <SectionCard title="Designations" description="Available ranks when creating or editing faculty. Removing one does not change existing records.">
      <div className="flex max-w-md gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="e.g. Professor of Practice" />
        <Button variant="outline" onClick={add}><Plus className="size-4" /> Add</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {list.map((d) => (
          <span key={d} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pr-1.5 pl-3 text-sm">
            {d}
            <button type="button" onClick={() => setList(list.filter((x) => x !== d))} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${d}`}><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <SaveBar onSave={() => save.mutate({ designations: list })} saving={save.isPending} dirty={list.length > 0} />
    </SectionCard>
  );
}

export function NotificationSettings({ settings }: { settings: SystemSettings }) {
  const save = useSaveSettings();
  const [v, setV] = useState(settings.notifications);
  return (
    <SectionCard title="Notification preferences" description="In-app notifications are always on. Email delivery is optional.">
      <div className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${settings.emailConfigured ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"}`}>
        <Mail className="mt-0.5 size-4 shrink-0" />
        {settings.emailConfigured ? "SMTP is configured on the server. Emails will be delivered when enabled." : "SMTP is not configured (SMTP_HOST is empty). Emails are logged by the API instead of being sent — core features keep working."}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Enable email notifications" checked={v.emailEnabled} onChange={(c) => setV({ ...v, emailEnabled: c })} />
        <Toggle label="Email leave decisions" description="Approval or rejection of leave" checked={v.emailOnLeaveDecision} onChange={(c) => setV({ ...v, emailOnLeaveDecision: c })} />
        <Toggle label="Email new announcements" checked={v.emailOnAnnouncement} onChange={(c) => setV({ ...v, emailOnAnnouncement: c })} />
        <Toggle label="Email workload allocations" checked={v.emailOnWorkload} onChange={(c) => setV({ ...v, emailOnWorkload: c })} />
      </div>
      <SaveBar onSave={() => save.mutate({ notifications: v })} saving={save.isPending} />
    </SectionCard>
  );
}
