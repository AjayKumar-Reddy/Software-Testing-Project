"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { useDepartments } from "@/hooks/use-options";
import { useAuth } from "@/contexts/auth-context";
import { apiError, post, put } from "@/lib/api";
import type { Announcement } from "@/types";

const schema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(200),
    content: z.string().trim().min(5, "Write the announcement").max(5000),
    priority: z.enum(["normal", "important", "urgent"]),
    category: z.enum(["general", "event", "academic", "administrative"]),
    audience: z.enum(["all", "departments"]),
    departments: z.array(z.string()),
    publishAt: z.string().min(1, "Choose when to publish"),
    expiresAt: z.string().optional(),
    eventDate: z.string().optional(),
    isPinned: z.boolean(),
  })
  .refine((d) => d.audience === "all" || d.departments.length > 0, { message: "Select at least one department", path: ["departments"] })
  .refine((d) => !d.expiresAt || d.expiresAt > d.publishAt, { message: "Expiry must be after publication", path: ["expiresAt"] })
  .refine((d) => d.category !== "event" || !!d.eventDate, { message: "Events need a date", path: ["eventDate"] });
type Values = z.infer<typeof schema>;

const local = (d?: string | null) => (d ? format(new Date(d), "yyyy-MM-dd'T'HH:mm") : "");

export function AnnouncementDialog({ open, onOpenChange, announcement }: { open: boolean; onOpenChange: (o: boolean) => void; announcement?: Announcement | null }) {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const isHod = role === "hod";
  const { data: departments } = useDepartments(true);
  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open)
      reset({
        title: announcement?.title ?? "",
        content: announcement?.content ?? "",
        priority: announcement?.priority ?? "normal",
        category: announcement?.category ?? "general",
        audience: isHod ? "departments" : announcement?.audience ?? "all",
        departments: isHod ? [user?.faculty?.department?._id ?? ""] : announcement?.departments.map((d) => d._id) ?? [],
        publishAt: local(announcement?.publishAt ?? new Date().toISOString()),
        expiresAt: local(announcement?.expiresAt),
        eventDate: announcement?.eventDate ? format(new Date(announcement.eventDate), "yyyy-MM-dd") : "",
        isPinned: announcement?.isPinned ?? false,
      });
  }, [open, announcement, reset, isHod, user]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        ...v,
        publishAt: new Date(v.publishAt).toISOString(),
        expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : null,
        eventDate: v.eventDate || null,
        departments: v.audience === "all" ? [] : v.departments,
      };
      return announcement ? put(`/announcements/${announcement._id}`, body) : post("/announcements", body);
    },
    onSuccess: (res) => {
      toast.success(res.message ?? "Saved");
      qc.invalidateQueries({ queryKey: ["announcements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const audience = watch("audience");
  const category = watch("category");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{announcement ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>Recipients get an in-app notification when it is published{isHod ? " (your department only)" : ""}.</DialogDescription>
        </DialogHeader>
        <form id="ann-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 sm:grid-cols-2" noValidate>
          <FormField label="Title" htmlFor="a-title" required error={errors.title?.message} className="sm:col-span-2"><Input id="a-title" {...register("title")} /></FormField>
          <FormField label="Message" htmlFor="a-content" required error={errors.content?.message} className="sm:col-span-2"><Textarea id="a-content" rows={5} {...register("content")} /></FormField>
          <FormField label="Priority">
            <Controller control={control} name="priority" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} options={[{ value: "normal", label: "Normal" }, { value: "important", label: "Important" }, { value: "urgent", label: "Urgent" }]} />} />
          </FormField>
          <FormField label="Category">
            <Controller control={control} name="category" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} options={[{ value: "general", label: "General" }, { value: "event", label: "Event" }, { value: "academic", label: "Academic" }, { value: "administrative", label: "Administrative" }]} />} />
          </FormField>
          <FormField label="Audience">
            <Controller control={control} name="audience" render={({ field }) => <AppSelect value={field.value} onChange={field.onChange} disabled={isHod} options={[{ value: "all", label: "All faculty" }, { value: "departments", label: "Specific departments" }]} />} />
          </FormField>
          <FormField label="Departments" error={errors.departments?.message}>
            <Controller control={control} name="departments" render={({ field }) => <Combobox multiple value={field.value} onChange={field.onChange} disabled={isHod || audience === "all"} placeholder={audience === "all" ? "Everyone" : "Select departments"} options={(departments ?? []).map((d) => ({ value: d._id, label: d.name }))} />} />
          </FormField>
          <FormField label="Publish at" htmlFor="a-pub" required error={errors.publishAt?.message} hint="Future dates schedule the announcement."><Input id="a-pub" type="datetime-local" {...register("publishAt")} /></FormField>
          <FormField label="Expires at" htmlFor="a-exp" error={errors.expiresAt?.message} hint="Optional"><Input id="a-exp" type="datetime-local" {...register("expiresAt")} /></FormField>
          {category === "event" && <FormField label="Event date" htmlFor="a-ev" required error={errors.eventDate?.message}><Input id="a-ev" type="date" {...register("eventDate")} /></FormField>}
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div><p className="text-sm font-medium">Pin to top</p><p className="text-xs text-muted-foreground">Pinned announcements appear first.</p></div>
            <Controller control={control} name="isPinned" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Pin announcement" />} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="ann-form" disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} {announcement ? "Save changes" : "Publish"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
