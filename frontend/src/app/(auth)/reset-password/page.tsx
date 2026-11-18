"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { apiError, post } from "@/lib/api";
import { resetSchema } from "@/schemas/auth";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (v: z.infer<typeof resetSchema>) => {
    try {
      await post("/auth/reset-password", { token, password: v.password });
      toast.success("Password updated. Please sign in.");
      router.replace("/login");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!token) {
    return (
      <div>
        <h2 className="font-heading text-2xl font-bold">Invalid reset link</h2>
        <p className="mt-2 text-sm text-muted-foreground">This link is missing its token. Request a new one.</p>
        <Button className="mt-6" render={<Link href="/forgot-password" />}>Request new link</Button>
      </div>
    );
  }

  return (
    <div>
      <Link href="/login" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10">
        <KeyRound className="size-6" />
      </span>
      <h2 className="mt-5 font-heading text-[28px] font-bold tracking-tight">Set a new password</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Use at least 8 characters, including a letter and a number.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <FormField label="New password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.password} {...register("password")} />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.confirm} {...register("confirm")} />
        </FormField>
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />} Update password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
