"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FacultyProfile, type FacultyDetail } from "@/components/faculty/faculty-profile";
import { useAuth } from "@/contexts/auth-context";
import { apiError, get, post, put } from "@/lib/api";
import { GENDERS } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/navigation";
import { formatDateTime, toInputDate } from "@/lib/utils";
import { changePasswordSchema } from "@/schemas/auth";
import type { AuthUser } from "@/types";

const phone = z.string().trim().regex(/^$|^[+\d][\d\s-]{5,19}$/, "Enter a valid phone number");
const selfSchema = z.object({
  phone: phone,
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  qualification: z.string().max(200).optional(),
  specialization: z.string().max(200).optional(),
  address: z.object({ line1: z.string(), city: z.string(), state: z.string(), postalCode: z.string(), country: z.string() }),
  emergencyContact: z.object({ name: z.string(), relation: z.string(), phone: phone }),
});
type SelfValues = z.infer<typeof selfSchema>;

function EditSelf({ faculty }: { faculty: FacultyDetail }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { register, control, handleSubmit, formState: { errors, isDirty } } = useForm<SelfValues>({
    resolver: zodResolver(selfSchema),
    defaultValues: {
      phone: faculty.phone ?? "",
      gender: faculty.gender ?? "",
      dateOfBirth: toInputDate(faculty.dateOfBirth),
      qualification: faculty.qualification ?? "",
      specialization: faculty.specialization ?? "",
      address: { line1: faculty.address?.line1 ?? "", city: faculty.address?.city ?? "", state: faculty.address?.state ?? "", postalCode: faculty.address?.postalCode ?? "", country: faculty.address?.country ?? "" },
      emergencyContact: { name: faculty.emergencyContact?.name ?? "", relation: faculty.emergencyContact?.relation ?? "", phone: faculty.emergencyContact?.phone ?? "" },
    },
  });
  const save = useMutation({
    mutationFn: (v: SelfValues) => put(`/faculty/${faculty._id}`, { ...v, gender: v.gender || undefined, dateOfBirth: v.dateOfBirth || undefined }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["faculty"] });
      router.replace("/profile");
    },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <SectionCard title="Edit my details" description="Department, designation, employment and email are managed by administrators.">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" noValidate>
        <FormField label="Phone" error={errors.phone?.message}><Input {...register("phone")} /></FormField>
        <FormField label="Gender"><Controller control={control} name="gender" render={({ field }) => <AppSelect value={field.value ?? ""} onChange={field.onChange} options={GENDERS} placeholder="Not specified" />} /></FormField>
        <FormField label="Date of birth"><Input type="date" {...register("dateOfBirth")} /></FormField>
        <FormField label="Qualification"><Input {...register("qualification")} /></FormField>
        <FormField label="Specialization" className="lg:col-span-2"><Input {...register("specialization")} /></FormField>
        <FormField label="Address" className="sm:col-span-2 lg:col-span-3"><Input {...register("address.line1")} /></FormField>
        <FormField label="City"><Input {...register("address.city")} /></FormField>
        <FormField label="State"><Input {...register("address.state")} /></FormField>
        <FormField label="Postal code"><Input {...register("address.postalCode")} /></FormField>
        <FormField label="Emergency contact"><Input {...register("emergencyContact.name")} /></FormField>
        <FormField label="Relation"><Input {...register("emergencyContact.relation")} /></FormField>
        <FormField label="Emergency phone" error={errors.emergencyContact?.phone?.message}><Input {...register("emergencyContact.phone")} /></FormField>
        <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="button" variant="outline" onClick={() => router.replace("/profile")}>Cancel</Button>
          <Button type="submit" disabled={!isDirty || save.isPending}>{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
        </div>
      </form>
    </SectionCard>
  );
}

function ChangePassword() {
  const { setSession } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof changePasswordSchema>>({ resolver: zodResolver(changePasswordSchema) });
  const onSubmit = async (v: z.infer<typeof changePasswordSchema>) => {
    try {
      const res = await post<{ accessToken: string; user: AuthUser }>("/auth/change-password", { currentPassword: v.currentPassword, newPassword: v.newPassword });
      setSession(res.data.accessToken, res.data.user);
      toast.success("Password changed. Other sessions were signed out.");
      reset({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  return (
    <SectionCard title="Change password" description="Use at least 8 characters with a letter and a number. Changing it signs you out on other devices.">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4" noValidate>
        <FormField label="Current password" htmlFor="cp" error={errors.currentPassword?.message}><Input id="cp" type="password" autoComplete="current-password" {...register("currentPassword")} /></FormField>
        <FormField label="New password" htmlFor="np" error={errors.newPassword?.message}><Input id="np" type="password" autoComplete="new-password" {...register("newPassword")} /></FormField>
        <FormField label="Confirm new password" htmlFor="cf" error={errors.confirm?.message}><Input id="cf" type="password" autoComplete="new-password" {...register("confirm")} /></FormField>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Update password</Button>
      </form>
    </SectionCard>
  );
}

function ProfileInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? "profile";
  const hasFaculty = Boolean(user?.faculty);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["faculty", "me"], queryFn: () => get<FacultyDetail>("/faculty/me"), enabled: hasFaculty });

  return (
    <div>
      <PageHeader title="My Profile" description="Your personal information, account and security." />
      <Tabs value={tab === "edit" && !hasFaculty ? "profile" : tab} onValueChange={(v) => router.replace(`/profile?tab=${v}`)}>
        <TabsList className="mb-4">
          <TabsTrigger value="profile" className="px-3"><UserRound className="size-4" /> Profile</TabsTrigger>
          {hasFaculty && <TabsTrigger value="edit" className="px-3"><Save className="size-4" /> Edit details</TabsTrigger>}
          <TabsTrigger value="security" className="px-3"><ShieldCheck className="size-4" /> Security</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          {hasFaculty ? (
            error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading || !data ? <TableSkeleton /> : <FacultyProfile faculty={data} canEdit selfView />
          ) : (
            <SectionCard>
              <div className="flex items-center gap-4">
                <UserAvatar name={user?.name} className="size-16 text-lg" />
                <div>
                  <p className="font-heading text-xl font-bold">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{user ? ROLE_LABELS[user.role] : ""} · Last sign-in {formatDateTime(user?.lastLoginAt)}</p>
                </div>
              </div>
            </SectionCard>
          )}
        </TabsContent>
        {hasFaculty && <TabsContent value="edit">{data ? <EditSelf faculty={data} /> : <TableSkeleton />}</TabsContent>}
        <TabsContent value="security"><ChangePassword /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileInner />
    </Suspense>
  );
}
