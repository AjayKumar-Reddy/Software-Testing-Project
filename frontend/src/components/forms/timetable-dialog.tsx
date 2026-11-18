"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { useFacultyOptions, useSubjectOptions } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { useDebounce } from "@/hooks/use-debounce";
import { apiError, del, post, put } from "@/lib/api";
import { WEEKDAYS } from "@/lib/constants";
import type { TimetableEntry } from "@/types";

export interface SlotDraft {
  entry?: TimetableEntry;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  faculty?: string;
  section?: string;
  room?: string;
}

export function TimetableDialog({ draft, onOpenChange }: { draft: SlotDraft | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: faculty } = useFacultyOptions();
  const [form, setForm] = useState({ faculty: "", subject: "", section: "", room: "", dayOfWeek: "1", startTime: "09:00", endTime: "09:55" });
  const [error, setError] = useState("");
  const { data: subjects } = useSubjectOptions({ faculty: form.faculty || undefined, academicYear: settings?.academicYear, mine: "false" });

  useEffect(() => {
    if (!draft) return;
    const e = draft.entry;
    setForm({
      faculty: e?.faculty._id ?? draft.faculty ?? "",
      subject: e?.subject._id ?? "",
      section: e?.section ?? draft.section ?? "",
      room: e?.room ?? draft.room ?? "",
      dayOfWeek: String(e?.dayOfWeek ?? draft.dayOfWeek ?? 1),
      startTime: e?.startTime ?? draft.startTime ?? "09:00",
      endTime: e?.endTime ?? draft.endTime ?? "09:55",
    });
    setError("");
  }, [draft]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v, ...(k === "faculty" ? { subject: "" } : {}) }));
  const ready = form.faculty && form.section && form.room && form.startTime && form.endTime && form.endTime > form.startTime;
  const probe = useDebounce(form, 300);
  const conflicts = useQuery({
    queryKey: ["timetable", "conflicts", probe, draft?.entry?._id],
    queryFn: async () =>
      (await post<{ conflicts: { types: string[]; message: string }[] }>(`/timetable/check-conflicts${draft?.entry ? `?excludeId=${draft.entry._id}` : ""}`, { ...probe, dayOfWeek: Number(probe.dayOfWeek) })).data.conflicts,
    enabled: !!draft && !!ready,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, dayOfWeek: Number(form.dayOfWeek) };
      return draft?.entry ? put(`/timetable/${draft.entry._id}`, body) : post("/timetable", body);
    },
    onSuccess: (res) => {
      toast.success(res.message ?? "Saved");
      qc.invalidateQueries({ queryKey: ["timetable"] });
      onOpenChange(false);
    },
    onError: (e) => setError(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: () => del(`/timetable/${draft!.entry!._id}`),
    onSuccess: () => {
      toast.success("Class removed");
      qc.invalidateQueries({ queryKey: ["timetable"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const slotOptions = useMemo(() => (settings?.timetableSlots ?? []).map((s) => ({ value: `${s.startTime}-${s.endTime}`, label: `${s.label} · ${s.startTime}–${s.endTime}` })), [settings]);
  const currentSlot = `${form.startTime}-${form.endTime}`;

  return (
    <Dialog open={!!draft} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.entry ? "Edit class" : "Schedule class"}</DialogTitle>
          <DialogDescription>Faculty, rooms and sections are checked for overlapping bookings.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Faculty" required className="sm:col-span-2">
            <Combobox value={form.faculty} onChange={set("faculty")} placeholder="Select faculty" options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: `${f.designation} · ${f.department?.code}` }))} />
          </FormField>
          <FormField label="Subject" required className="sm:col-span-2" hint={form.faculty && !subjects?.length ? "This faculty member has no subjects allocated. Allocate one first." : "Only subjects allocated to the selected faculty are listed."}>
            <AppSelect value={form.subject} onChange={set("subject")} disabled={!form.faculty} placeholder={form.faculty ? "Select subject" : "Select a faculty member first"} options={(subjects ?? []).map((s) => ({ value: s._id, label: `${s.code} – ${s.name}` }))} />
          </FormField>
          <FormField label="Section / class" required><Input value={form.section} onChange={(e) => set("section")(e.target.value.toUpperCase())} placeholder="CSE-5A" /></FormField>
          <FormField label="Room" required><Input value={form.room} onChange={(e) => set("room")(e.target.value.toUpperCase())} placeholder="CS-101" /></FormField>
          <FormField label="Day" required>
            <AppSelect value={form.dayOfWeek} onChange={set("dayOfWeek")} options={(settings?.workingDays ?? [1, 2, 3, 4, 5, 6]).map((d) => ({ value: String(d), label: WEEKDAYS[d] }))} />
          </FormField>
          <FormField label="Time slot">
            <AppSelect value={slotOptions.some((o) => o.value === currentSlot) ? currentSlot : ""} onChange={(v) => { const [s, e] = v.split("-"); setForm((f) => ({ ...f, startTime: s, endTime: e })); }} options={slotOptions} placeholder="Custom time" />
          </FormField>
          <FormField label="Start time" required><Input type="time" value={form.startTime} onChange={(e) => set("startTime")(e.target.value)} /></FormField>
          <FormField label="End time" required error={form.endTime && form.endTime <= form.startTime ? "End time must be after start time" : undefined}><Input type="time" value={form.endTime} onChange={(e) => set("endTime")(e.target.value)} /></FormField>
        </div>
        {ready && (conflicts.data?.length ? (
          <div className="space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" /> Scheduling conflict</p>
            {conflicts.data.map((c, i) => <p key={i}>{c.message}</p>)}
          </div>
        ) : conflicts.isSuccess ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="size-3.5" /> No conflicts for this slot</p>
        ) : null)}
        {error && <p className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{error}</p>}
        <DialogFooter className="sm:justify-between">
          {draft?.entry ? (
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash2 className="size-4" /> Remove</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => { setError(""); save.mutate(); }} disabled={!ready || !form.subject || save.isPending || !!conflicts.data?.length}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />} {draft?.entry ? "Save changes" : "Schedule"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
