"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { apiError, post, put } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { Department } from "@/types";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  code: z.string().trim().toUpperCase().min(2, "Code is required").max(12).regex(/^[A-Z0-9&-]+$/, "Letters and digits only"),
  description: z.string().max(2000).optional(),
  establishedYear: z.union([z.coerce.number().int().min(1900).max(2100), z.literal("")]).optional(),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().max(20).optional(),
  location: z.string().max(120).optional(),
});
type Values = z.infer<typeof schema>;

export function DepartmentDialog({ open, onOpenChange, department }: { open: boolean; onOpenChange: (o: boolean) => void; department?: Department | null }) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open)
      reset({
        name: department?.name ?? "",
        code: department?.code ?? "",
        description: department?.description ?? "",
        establishedYear: department?.establishedYear ?? "",
        email: department?.email ?? "",
        phone: department?.phone ?? "",
        location: department?.location ?? "",
      });
  }, [open, department, reset]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { ...v, establishedYear: v.establishedYear === "" ? undefined : v.establishedYear };
      return department ? put(`/departments/${department._id}`, body) : post("/departments", body);
    },
    onSuccess: (res) => {
      toast.success(res.message ?? "Saved");
      qc.invalidateQueries({ queryKey: ["departments"] });
      qc.invalidateQueries({ queryKey: ["department"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{department ? "Edit department" : "New department"}</DialogTitle>
          <DialogDescription>{department ? "Update department details." : "Create a new academic department."}</DialogDescription>
        </DialogHeader>
        <form id="dept-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Department name" htmlFor="d-name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="d-name" disabled={!isAdmin} {...register("name")} />
          </FormField>
          <FormField label="Code" htmlFor="d-code" required error={errors.code?.message}>
            <Input id="d-code" className="uppercase" disabled={!isAdmin} {...register("code")} />
          </FormField>
          <FormField label="Established" htmlFor="d-year" error={errors.establishedYear?.message as string | undefined}>
            <Input id="d-year" type="number" disabled={!isAdmin} {...register("establishedYear")} />
          </FormField>
          <FormField label="Email" htmlFor="d-email" error={errors.email?.message}><Input id="d-email" {...register("email")} /></FormField>
          <FormField label="Phone" htmlFor="d-phone"><Input id="d-phone" {...register("phone")} /></FormField>
          <FormField label="Location" htmlFor="d-loc" className="sm:col-span-2"><Input id="d-loc" placeholder="Block A, 2nd floor" {...register("location")} /></FormField>
          <FormField label="Description" htmlFor="d-desc" className="sm:col-span-2"><Textarea id="d-desc" rows={3} {...register("description")} /></FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="dept-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} {department ? "Save changes" : "Create department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
