"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { useFacultyOptions, useSubjectOptions } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { apiError, post, put } from "@/lib/api";
import type { Workload } from "@/types";

const schema = z.object({
  faculty: z.string().min(1, "Select a faculty member"),
  subject: z.string().min(1, "Select a subject"),
  weeklyHours: z.coerce.number({ invalid_type_error: "Enter hours" }).min(0.5, "At least 0.5 hours").max(40),
  type: z.enum(["lecture", "lab", "tutorial"]),
  section: z.string().trim().toUpperCase().min(1, "Section is required").max(10),
  notes: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

export function WorkloadDialog({ open, onOpenChange, workload }: { open: boolean; onOpenChange: (o: boolean) => void; workload?: Workload | null }) {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: faculty } = useFacultyOptions();
  const { data: subjects } = useSubjectOptions({ academicYear: settings?.academicYear, mine: "false" });
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open)
      reset({
        faculty: workload?.faculty._id ?? "",
        subject: workload?.subject._id ?? "",
        weeklyHours: workload?.weeklyHours ?? 3,
        type: workload?.type ?? "lecture",
        section: workload?.section ?? "A",
        notes: workload?.notes ?? "",
      });
  }, [open, workload, reset]);

  const save = useMutation({
    mutationFn: (v: Values) => (workload ? put<{ warning?: string }>(`/workload/${workload._id}`, { weeklyHours: v.weeklyHours, type: v.type, section: v.section, notes: v.notes }) : post<{ warning?: string }>("/workload", v)),
    onSuccess: (res) => {
      if (res.data?.warning) toast.warning(res.data.warning, { duration: 7000 });
      else toast.success(res.message ?? "Saved");
      qc.invalidateQueries({ queryKey: ["workload"] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["allocation"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{workload ? "Edit allocation" : "Allocate workload"}</DialogTitle>
          <DialogDescription>
            Weekly limits: {settings?.workload.minWeeklyHours}–{settings?.workload.maxWeeklyHours} hrs. Exceeding the maximum is allowed but flagged.
          </DialogDescription>
        </DialogHeader>
        <form id="wl-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Faculty" required error={errors.faculty?.message} className="sm:col-span-2">
            <Controller control={control} name="faculty" render={({ field }) => <Combobox value={field.value} onChange={field.onChange} disabled={!!workload} invalid={!!errors.faculty} placeholder="Select faculty" options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: `${f.designation} · ${f.department?.code}` }))} />} />
          </FormField>
          <FormField label="Subject" required error={errors.subject?.message} className="sm:col-span-2">
            <Controller control={control} name="subject" render={({ field }) => <Combobox value={field.value} onChange={field.onChange} disabled={!!workload} invalid={!!errors.subject} placeholder="Select subject" options={(subjects ?? []).map((s) => ({ value: s._id, label: `${s.code} – ${s.name}`, description: `${s.department?.code} · Sem ${s.semester} · ${s.weeklyHours} hrs/wk` }))} />} />
          </FormField>
          <FormField label="Weekly hours" htmlFor="wl-hours" required error={errors.weeklyHours?.message}>
            <Input id="wl-hours" type="number" step="0.5" min={0.5} max={40} {...register("weeklyHours")} />
          </FormField>
          <FormField label="Type">
            <Controller control={control} name="type" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} options={[{ value: "lecture", label: "Lecture" }, { value: "lab", label: "Lab" }, { value: "tutorial", label: "Tutorial" }]} />} />
          </FormField>
          <FormField label="Section" htmlFor="wl-sec" required error={errors.section?.message}><Input id="wl-sec" className="uppercase" {...register("section")} /></FormField>
          <FormField label="Notes" htmlFor="wl-notes"><Input id="wl-notes" {...register("notes")} /></FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="wl-form" disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} {workload ? "Save" : "Allocate"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
