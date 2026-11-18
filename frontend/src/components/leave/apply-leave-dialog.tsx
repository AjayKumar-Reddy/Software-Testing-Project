"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eachDayOfInterval, parseISO } from "date-fns";
import { FileUp, Info, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { useSettings } from "@/hooks/use-settings";
import { useFacultyOptions } from "@/hooks/use-options";
import { useAuth } from "@/contexts/auth-context";
import { apiError, get, post } from "@/lib/api";
import { LEAVE_TYPES } from "@/lib/constants";
import { todayInput } from "@/lib/utils";
import type { LeaveBalance } from "@/types";

const schema = z
  .object({
    faculty: z.string().optional(),
    leaveType: z.string().min(1, "Select a leave type"),
    startDate: z.string().min(1, "Select a start date"),
    endDate: z.string().min(1, "Select an end date"),
    reason: z.string().trim().min(5, "Please give a reason (min 5 characters)").max(1000),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, { message: "End date cannot be before start date", path: ["endDate"] });
type Values = z.infer<typeof schema>;

export function ApplyLeaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const { data: settings } = useSettings();
  const needsFaculty = role === "admin" && !user?.faculty;
  const { data: faculty } = useFacultyOptions();
  const [file, setFile] = useState<File | null>(null);
  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { leaveType: "casual", startDate: todayInput(), endDate: todayInput(), reason: "", faculty: "" } });

  useEffect(() => {
    if (open) {
      reset({ leaveType: "casual", startDate: todayInput(), endDate: todayInput(), reason: "", faculty: "" });
      setFile(null);
    }
  }, [open, reset]);

  const [start, end, type, fac] = watch(["startDate", "endDate", "leaveType", "faculty"]);
  const balanceFor = needsFaculty ? fac : undefined;
  const { data: balance } = useQuery({
    queryKey: ["leave-balance", balanceFor ?? "me"],
    queryFn: () => get<LeaveBalance[]>("/leaves/balance", { faculty: balanceFor }),
    enabled: open && (!needsFaculty || !!fac),
  });
  const days = useMemo(() => {
    if (!start || !end || end < start || !settings) return 0;
    return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).filter((d) => settings.workingDays.includes(d.getDay())).length;
  }, [start, end, settings]);
  const avail = balance?.find((b) => b.type === type);

  const apply = useMutation({
    mutationFn: (v: Values) => {
      const fd = new FormData();
      fd.append("leaveType", v.leaveType);
      fd.append("startDate", v.startDate);
      fd.append("endDate", v.endDate);
      fd.append("reason", v.reason);
      if (needsFaculty && v.faculty) fd.append("faculty", v.faculty);
      if (file) fd.append("document", file);
      return post("/leaves", fd);
    },
    onSuccess: () => {
      toast.success("Leave application submitted");
      qc.invalidateQueries({ queryKey: ["leaves"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
          <DialogDescription>Your department head and administrators will be notified.</DialogDescription>
        </DialogHeader>
        <form id="leave-form" onSubmit={handleSubmit((v) => { if (needsFaculty && !v.faculty) return toast.error("Select a faculty member"); apply.mutate(v); })} className="grid gap-4 sm:grid-cols-2" noValidate>
          {needsFaculty && (
            <FormField label="Faculty member" required className="sm:col-span-2">
              <Controller control={control} name="faculty" render={({ field }) => <Combobox value={field.value ?? ""} onChange={field.onChange} placeholder="Apply on behalf of…" options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: f.facultyId }))} />} />
            </FormField>
          )}
          <FormField label="Leave type" required error={errors.leaveType?.message} className="sm:col-span-2">
            <Controller control={control} name="leaveType" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} options={LEAVE_TYPES} />} />
          </FormField>
          <FormField label="From" htmlFor="l-start" required error={errors.startDate?.message}>
            <Input id="l-start" type="date" {...register("startDate")} />
          </FormField>
          <FormField label="To" htmlFor="l-end" required error={errors.endDate?.message}>
            <Input id="l-end" type="date" min={start} {...register("endDate")} />
          </FormField>
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-900 sm:col-span-2 dark:bg-blue-500/10 dark:text-blue-200">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <b>{days}</b> working day{days === 1 ? "" : "s"} requested.
              {avail && <> {avail.available} {type} day(s) available ({avail.used} used, {avail.pending} pending).</>}
              {avail && days > avail.available && <b className="text-rose-600"> Exceeds available balance.</b>}
            </span>
          </div>
          <FormField label="Reason" htmlFor="l-reason" required error={errors.reason?.message} className="sm:col-span-2">
            <Textarea id="l-reason" rows={3} placeholder="Briefly describe the reason for leave" {...register("reason")} />
          </FormField>
          <FormField label="Supporting document" hint="Optional. PDF, Word or image, up to 5 MB." className="sm:col-span-2">
            {file ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => setFile(null)} aria-label="Remove file"><X className="size-3.5" /></Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground transition hover:bg-muted/50">
                <FileUp className="size-4" /> Choose a file
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 5 * 1024 * 1024) return toast.error("File must be 5 MB or smaller");
                    setFile(f ?? null);
                  }}
                />
              </label>
            )}
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="leave-form" disabled={apply.isPending || days === 0}>{apply.isPending && <Loader2 className="size-4 animate-spin" />} Submit application</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
