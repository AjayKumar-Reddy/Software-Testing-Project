"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { apiError, post } from "@/lib/api";
import { forgotSchema } from "@/schemas/auth";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<{ email: string; devResetUrl?: string } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (v: z.infer<typeof forgotSchema>) => {
    try {
      const res = await post<{ devResetUrl?: string }>("/auth/forgot-password", v);
      setSent({ email: v.email, devResetUrl: res.data?.devResetUrl });
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <Link href="/login" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      {sent ? (
        <div>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
            <MailCheck className="size-6" />
          </span>
          <h2 className="mt-5 font-heading text-2xl font-bold">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{sent.email}</span>, we&apos;ve sent a link to reset your password. The link expires in 30 minutes.
          </p>
          {sent.devResetUrl && (
            <div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="font-semibold">Development mode: SMTP is not configured</p>
              <p className="mt-1">The email was logged by the API instead of being sent. Use this link:</p>
              <a href={sent.devResetUrl} className="mt-2 block break-all font-mono text-blue-700 underline dark:text-blue-300">
                {sent.devResetUrl}
              </a>
            </div>
          )}
        </div>
      ) : (
        <>
          <h2 className="font-heading text-[28px] font-bold tracking-tight">Forgot password?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Enter your account email and we&apos;ll send you a reset link.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            <FormField label="Email address" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" className="h-10" placeholder="name@institution.edu" aria-invalid={!!errors.email} {...register("email")} />
            </FormField>
            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />} Send reset link
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
