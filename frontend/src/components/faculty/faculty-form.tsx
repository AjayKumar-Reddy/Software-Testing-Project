"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Copy, IdCard, KeyRound, Loader2, MapPin, Save, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { useDepartments } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/auth-context";
import { apiError, post, put } from "@/lib/api";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, GENDERS } from "@/lib/constants";
import { toInputDate } from "@/lib/utils";
import { facultySchema, type FacultyFormValues } from "@/schemas/faculty";
import type { Faculty } from "@/types";

function Section({ icon: Icon, title, description, children }: { icon: typeof User; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b px-6 py-7 last:border-0 lg:grid-cols-[260px_1fr]">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            <Icon className="size-4" />
          </span>
          <h3 className="font-heading text-[15px] font-semibold">{title}</h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FacultyForm({ faculty }: { faculty?: Faculty }) {
  const isEdit = Boolean(faculty);
  const router = useRouter();
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const { data: departments } = useDepartments();
  const { data: settings } = useSettings();
  const [created, setCreated] = useState<{ id: string; name: string; email: string; password?: string } | null>(null);

  const form = useForm<FacultyFormValues>({
    resolver: zodResolver(facultySchema),
    defaultValues: {
      facultyId: faculty?.facultyId ?? "",
      firstName: faculty?.firstName ?? "",
      lastName: faculty?.lastName ?? "",
      gender: faculty?.gender ?? "",
      dateOfBirth: toInputDate(faculty?.dateOfBirth),
      email: faculty?.email ?? "",
      phone: faculty?.phone ?? "",
      address: { line1: faculty?.address?.line1 ?? "", city: faculty?.address?.city ?? "", state: faculty?.address?.state ?? "", postalCode: faculty?.address?.postalCode ?? "", country: faculty?.address?.country ?? "India" },
      emergencyContact: { name: faculty?.emergencyContact?.name ?? "", relation: faculty?.emergencyContact?.relation ?? "", phone: faculty?.emergencyContact?.phone ?? "" },
      department: faculty?.department?._id ?? (role === "hod" ? user?.faculty?.department?._id ?? "" : ""),
      designation: faculty?.designation ?? "",
      qualification: faculty?.qualification ?? "",
      specialization: faculty?.specialization ?? "",
      experienceYears: faculty?.experienceYears ?? 0,
      dateOfJoining: toInputDate(faculty?.dateOfJoining),
      employmentType: faculty?.employmentType ?? "full_time",
      status: faculty?.status ?? "active",
      createAccount: true,
      password: "",
    },
  });
  const { register, control, handleSubmit, watch, formState: { errors, isDirty } } = form;

  const save = useMutation({
    mutationFn: async (v: FacultyFormValues) => {
      const payload: Record<string, unknown> = { ...v, gender: v.gender || undefined, dateOfBirth: v.dateOfBirth || undefined, facultyId: v.facultyId || undefined };
      if (isEdit) {
        delete payload.createAccount;
        delete payload.password;
        return put<Faculty>(`/faculty/${faculty!._id}`, payload);
      }
      return post<{ faculty: Faculty; temporaryPassword?: string }>("/faculty", { ...payload, password: v.password || undefined });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["faculty"] });
      qc.invalidateQueries({ queryKey: ["faculty-options"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (isEdit) {
        toast.success("Faculty profile updated");
        router.push(`/faculty/${faculty!._id}`);
      } else {
        const d = res.data as { faculty: Faculty; temporaryPassword?: string };
        toast.success(`${d.faculty.firstName} ${d.faculty.lastName} added as ${d.faculty.facultyId}`);
        if (d.temporaryPassword) setCreated({ id: d.faculty._id, name: `${d.faculty.firstName} ${d.faculty.lastName}`, email: d.faculty.email, password: d.temporaryPassword });
        else router.push(`/faculty/${d.faculty._id}`);
      }
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const createAccount = watch("createAccount");

  return (
    <>
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="overflow-hidden rounded-xl border bg-card shadow-card">
        <Section icon={User} title="Personal details" description="Basic identity information. Gender and date of birth are optional.">
          <FormField label="First name" htmlFor="firstName" required error={errors.firstName?.message}>
            <Input id="firstName" aria-invalid={!!errors.firstName} {...register("firstName")} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName" required error={errors.lastName?.message}>
            <Input id="lastName" aria-invalid={!!errors.lastName} {...register("lastName")} />
          </FormField>
          <FormField label="Gender" htmlFor="gender">
            <Controller control={control} name="gender" render={({ field }) => <AppSelect id="gender" value={field.value ?? ""} onChange={field.onChange} options={GENDERS} placeholder="Not specified" />} />
          </FormField>
          <FormField label="Date of birth" htmlFor="dateOfBirth">
            <Input id="dateOfBirth" type="date" max={toInputDate(new Date())} {...register("dateOfBirth")} />
          </FormField>
        </Section>

        <Section icon={MapPin} title="Contact & address" description="Used for official communication and emergencies.">
          <FormField label="Email" htmlFor="email" required error={errors.email?.message} hint={isEdit ? "Changing the email also changes the sign-in email." : "Also used as the login email."}>
            <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" placeholder="+91 98765 43210" aria-invalid={!!errors.phone} {...register("phone")} />
          </FormField>
          <FormField label="Address" htmlFor="line1" className="sm:col-span-2">
            <Input id="line1" placeholder="Street, building" {...register("address.line1")} />
          </FormField>
          <FormField label="City" htmlFor="city"><Input id="city" {...register("address.city")} /></FormField>
          <FormField label="State" htmlFor="state"><Input id="state" {...register("address.state")} /></FormField>
          <FormField label="Postal code" htmlFor="postalCode"><Input id="postalCode" {...register("address.postalCode")} /></FormField>
          <FormField label="Country" htmlFor="country"><Input id="country" {...register("address.country")} /></FormField>
          <FormField label="Emergency contact name" htmlFor="ecName"><Input id="ecName" {...register("emergencyContact.name")} /></FormField>
          <FormField label="Relation" htmlFor="ecRel"><Input id="ecRel" placeholder="Spouse, parent…" {...register("emergencyContact.relation")} /></FormField>
          <FormField label="Emergency contact phone" htmlFor="ecPhone" error={errors.emergencyContact?.phone?.message}>
            <Input id="ecPhone" {...register("emergencyContact.phone")} />
          </FormField>
        </Section>

        <Section icon={Briefcase} title="Professional details" description="Department, rank and employment terms. Some fields are restricted to administrators.">
          <FormField label="Faculty ID" htmlFor="facultyId" error={errors.facultyId?.message} hint={isEdit ? undefined : "Leave blank to auto-generate (e.g. FAC0031)."}>
            <Input id="facultyId" className="font-mono uppercase" disabled={isEdit && role !== "admin"} placeholder="Auto-generated" {...register("facultyId")} />
          </FormField>
          <FormField label="Department" htmlFor="department" required error={errors.department?.message}>
            <Controller
              control={control}
              name="department"
              render={({ field }) => (
                <AppSelect id="department" value={field.value} onChange={field.onChange} invalid={!!errors.department} disabled={role !== "admin"} options={(departments ?? []).map((d) => ({ value: d._id, label: `${d.name} (${d.code})` }))} placeholder="Select department" />
              )}
            />
          </FormField>
          <FormField label="Designation" htmlFor="designation" required error={errors.designation?.message}>
            <Controller control={control} name="designation" render={({ field }) => <AppSelect id="designation" value={field.value} onChange={field.onChange} invalid={!!errors.designation} options={(settings?.designations ?? []).map((d) => ({ value: d, label: d }))} placeholder="Select designation" />} />
          </FormField>
          <FormField label="Date of joining" htmlFor="dateOfJoining" required error={errors.dateOfJoining?.message}>
            <Input id="dateOfJoining" type="date" aria-invalid={!!errors.dateOfJoining} {...register("dateOfJoining")} />
          </FormField>
          <FormField label="Qualification" htmlFor="qualification"><Input id="qualification" placeholder="e.g. Ph.D. (Computer Science)" {...register("qualification")} /></FormField>
          <FormField label="Specialization" htmlFor="specialization"><Input id="specialization" placeholder="e.g. Machine Learning" {...register("specialization")} /></FormField>
          <FormField label="Experience (years)" htmlFor="experienceYears" error={errors.experienceYears?.message}>
            <Input id="experienceYears" type="number" min={0} max={60} {...register("experienceYears")} />
          </FormField>
          <FormField label="Employment type" htmlFor="employmentType">
            <Controller control={control} name="employmentType" render={({ field }) => <AppSelect id="employmentType" value={field.value} onChange={field.onChange} options={EMPLOYMENT_TYPES} />} />
          </FormField>
          <FormField label="Employment status" htmlFor="status">
            <Controller control={control} name="status" render={({ field }) => <AppSelect id="status" value={field.value} onChange={field.onChange} options={EMPLOYMENT_STATUSES} />} />
          </FormField>
        </Section>

        {!isEdit && (
          <Section icon={KeyRound} title="Login account" description="Create a FacultyHub sign-in for this person. If you don't set a password, a temporary one is generated and shown once.">
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Create login account</p>
                <p className="text-xs text-muted-foreground">Role: Faculty. HODs are assigned from the Departments page.</p>
              </div>
              <Controller control={control} name="createAccount" render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Create login account" />} />
            </div>
            {createAccount && (
              <FormField label="Initial password" htmlFor="password" error={errors.password?.message} hint="Optional. Leave blank to auto-generate.">
                <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
              </FormField>
            )}
          </Section>
        )}

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={save.isPending || (isEdit && !isDirty)}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isEdit ? "Save changes" : "Create faculty"}
          </Button>
        </div>
      </form>

      <Dialog open={!!created} onOpenChange={(o) => !o && created && router.push(`/faculty/${created.id}`)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><IdCard className="size-4" /> Account created</DialogTitle>
            <DialogDescription>Share these sign-in details with {created?.name}. The temporary password is shown only once.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <p><span className="text-muted-foreground">Email:</span> <span className="font-medium">{created?.email}</span></p>
            <p className="flex items-center gap-2"><span className="text-muted-foreground">Temporary password:</span> <code className="rounded bg-background px-1.5 py-0.5 font-mono">{created?.password}</code>
              <Button variant="ghost" size="icon-xs" aria-label="Copy password" onClick={() => { navigator.clipboard?.writeText(created?.password ?? ""); toast.success("Copied"); }}><Copy className="size-3" /></Button>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => created && router.push(`/faculty/${created.id}`)}>Go to profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
