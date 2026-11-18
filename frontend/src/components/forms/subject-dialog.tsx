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
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { useCourses, useDepartments, useFacultyOptions } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/auth-context";
import { apiError, post, put } from "@/lib/api";
import { SEMESTERS } from "@/lib/constants";
import type { Subject } from "@/types";

const schema = z.object({
  name: z.string().trim().min(2, "Subject name is required").max(150),
  code: z.string().trim().toUpperCase().min(2, "Code is required").max(20).regex(/^[A-Z0-9-]+$/, "Letters, digits and dashes only"),
  department: z.string().min(1, "Select a department"),
  course: z.string().optional(),
  semester: z.string().min(1, "Select a semester"),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/, "Format: 2026-27"),
  credits: z.coerce.number({ invalid_type_error: "Enter a number" }).min(0).max(10),
  type: z.string(),
  weeklyHours: z.coerce.number().min(0).max(20),
  description: z.string().max(2000).optional(),
  assignedFaculty: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

export function SubjectDialog({ open, onOpenChange, subject }: { open: boolean; onOpenChange: (o: boolean) => void; subject?: Subject | null }) {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const { data: settings } = useSettings();
  const { data: departments } = useDepartments();
  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  const dept = watch("department");
  const { data: courses } = useCourses(dept || undefined);
  const { data: faculty } = useFacultyOptions(role === "hod" ? user?.faculty?.department?._id : undefined);

  useEffect(() => {
    if (open)
      reset({
        name: subject?.name ?? "",
        code: subject?.code ?? "",
        department: subject?.department?._id ?? (role === "hod" ? user?.faculty?.department?._id ?? "" : ""),
        course: subject?.course?._id ?? "",
        semester: subject ? String(subject.semester) : "",
        academicYear: subject?.academicYear ?? settings?.academicYear ?? "",
        credits: subject?.credits ?? 3,
        type: subject?.type ?? "theory",
        weeklyHours: subject?.weeklyHours ?? 3,
        description: subject?.description ?? "",
        assignedFaculty: subject?.assignedFaculty.map((f) => f._id) ?? [],
      });
  }, [open, subject, reset, settings, role, user]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { ...v, semester: Number(v.semester), course: v.course || null };
      return subject ? put(`/subjects/${subject._id}`, body) : post("/subjects", body);
    },
    onSuccess: (res) => {
      toast.success(res.message ?? "Saved");
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["subject-options"] });
      qc.invalidateQueries({ queryKey: ["allocation"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{subject ? `Edit ${subject.code}` : "New subject"}</DialogTitle>
          <DialogDescription>Subject codes must be unique across the institution.</DialogDescription>
        </DialogHeader>
        <form id="subject-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 sm:grid-cols-6" noValidate>
          <FormField label="Subject name" htmlFor="s-name" required error={errors.name?.message} className="sm:col-span-4">
            <Input id="s-name" {...register("name")} />
          </FormField>
          <FormField label="Code" htmlFor="s-code" required error={errors.code?.message} className="sm:col-span-2">
            <Input id="s-code" className="uppercase" {...register("code")} />
          </FormField>
          <FormField label="Department" required error={errors.department?.message} className="sm:col-span-3">
            <Controller control={control} name="department" render={({ field }) => (
              <AppSelect value={field.value} onChange={(v) => { field.onChange(v); setValue("course", ""); }} disabled={role !== "admin"} invalid={!!errors.department} options={(departments ?? []).map((d) => ({ value: d._id, label: d.name }))} placeholder="Select department" />
            )} />
          </FormField>
          <FormField label="Course" className="sm:col-span-3">
            <Controller control={control} name="course" render={({ field }) => (
              <AppSelect value={field.value ?? ""} onChange={field.onChange} options={(courses ?? []).map((c) => ({ value: c._id, label: c.name }))} placeholder={dept ? "Select course" : "Choose a department first"} disabled={!dept} />
            )} />
          </FormField>
          <FormField label="Semester" required error={errors.semester?.message} className="sm:col-span-2">
            <Controller control={control} name="semester" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} options={SEMESTERS} invalid={!!errors.semester} />} />
          </FormField>
          <FormField label="Academic year" htmlFor="s-year" required error={errors.academicYear?.message} className="sm:col-span-2">
            <Input id="s-year" placeholder="2026-27" {...register("academicYear")} />
          </FormField>
          <FormField label="Type" className="sm:col-span-2">
            <Controller control={control} name="type" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} options={[{ value: "theory", label: "Theory" }, { value: "lab", label: "Lab" }, { value: "elective", label: "Elective" }]} />} />
          </FormField>
          <FormField label="Credits" htmlFor="s-credits" required error={errors.credits?.message} className="sm:col-span-3">
            <Input id="s-credits" type="number" step="0.5" min={0} max={10} {...register("credits")} />
          </FormField>
          <FormField label="Contact hours / week" htmlFor="s-hours" error={errors.weeklyHours?.message} className="sm:col-span-3">
            <Input id="s-hours" type="number" step="0.5" min={0} max={20} {...register("weeklyHours")} />
          </FormField>
          <FormField label="Assigned faculty" className="sm:col-span-6" hint="Faculty with workload for this subject can't be removed here.">
            <Controller control={control} name="assignedFaculty" render={({ field }) => (
              <Combobox multiple value={field.value} onChange={field.onChange} placeholder="Select faculty" options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: `${f.designation} · ${f.department?.code}` }))} />
            )} />
          </FormField>
          <FormField label="Description" htmlFor="s-desc" className="sm:col-span-6"><Textarea id="s-desc" rows={2} {...register("description")} /></FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="subject-form" disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} {subject ? "Save changes" : "Create subject"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
