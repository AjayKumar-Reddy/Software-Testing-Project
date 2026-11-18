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
import { useDepartments } from "@/hooks/use-options";
import { useAuth } from "@/contexts/auth-context";
import { apiError, post, put } from "@/lib/api";
import type { Course } from "@/types";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  code: z.string().trim().toUpperCase().min(2, "Code is required").max(20),
  department: z.string().min(1, "Select a department"),
  level: z.enum(["UG", "PG", "Diploma", "PhD"]),
  durationYears: z.coerce.number().int().min(1).max(6),
  totalSemesters: z.coerce.number().int().min(1).max(12),
  intake: z.coerce.number().int().min(0).max(2000),
  description: z.string().max(2000).optional(),
});
type Values = z.infer<typeof schema>;

export function CourseDialog({ open, onOpenChange, course }: { open: boolean; onOpenChange: (o: boolean) => void; course?: Course | null }) {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const { data: departments } = useDepartments();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open)
      reset({
        name: course?.name ?? "",
        code: course?.code ?? "",
        department: course?.department?._id ?? (role === "hod" ? user?.faculty?.department?._id ?? "" : ""),
        level: course?.level ?? "UG",
        durationYears: course?.durationYears ?? 4,
        totalSemesters: course?.totalSemesters ?? 8,
        intake: course?.intake ?? 60,
        description: course?.description ?? "",
      });
  }, [open, course, reset, role, user]);

  const save = useMutation({
    mutationFn: (v: Values) => (course ? put(`/courses/${course._id}`, v) : post("/courses", v)),
    onSuccess: (res) => {
      toast.success(res.message ?? "Saved");
      qc.invalidateQueries({ queryKey: ["courses"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{course ? "Edit course" : "New course"}</DialogTitle>
          <DialogDescription>A course is a degree programme that subjects belong to.</DialogDescription>
        </DialogHeader>
        <form id="course-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Course name" htmlFor="c-name" required error={errors.name?.message} className="sm:col-span-2"><Input id="c-name" {...register("name")} /></FormField>
          <FormField label="Code" htmlFor="c-code" required error={errors.code?.message}><Input id="c-code" className="uppercase" {...register("code")} /></FormField>
          <FormField label="Level">
            <Controller control={control} name="level" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} options={["UG", "PG", "Diploma", "PhD"].map((l) => ({ value: l, label: l }))} />} />
          </FormField>
          <FormField label="Department" required error={errors.department?.message} className="sm:col-span-2">
            <Controller control={control} name="department" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} disabled={role !== "admin"} invalid={!!errors.department} options={(departments ?? []).map((d) => ({ value: d._id, label: d.name }))} placeholder="Select department" />} />
          </FormField>
          <FormField label="Duration (years)" htmlFor="c-dur" error={errors.durationYears?.message}><Input id="c-dur" type="number" {...register("durationYears")} /></FormField>
          <FormField label="Total semesters" htmlFor="c-sem" error={errors.totalSemesters?.message}><Input id="c-sem" type="number" {...register("totalSemesters")} /></FormField>
          <FormField label="Annual intake" htmlFor="c-int" error={errors.intake?.message}><Input id="c-int" type="number" {...register("intake")} /></FormField>
          <FormField label="Description" htmlFor="c-desc" className="sm:col-span-2"><Textarea id="c-desc" rows={2} {...register("description")} /></FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="course-form" disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} {course ? "Save" : "Create course"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
