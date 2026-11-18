"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { BrandMark } from "@/components/layout/brand";
import { useAuth } from "@/contexts/auth-context";
import { apiError } from "@/lib/api";
import { firstName } from "@/lib/utils";
import { loginSchema, type LoginValues } from "@/schemas/auth";
import { ROLE_LABELS } from "@/lib/navigation";

const SHOW_DEMO = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "Demo@123";
const DEMO = [
  { role: "admin" as const, email: "admin@facultyhub.com" },
  { role: "hod" as const, email: "hod@facultyhub.com" },
  { role: "faculty" as const, email: "faculty@facultyhub.com" },
];

function LoginForm() {
  const { login } = useAuth();
  const params = useSearchParams();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${firstName(user.name)}!`);
      // Redirect is handled by the auth layout once the session is set (it honours ?next=).
    } catch (e) {
      setError(apiError(e, "Unable to sign in"));
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <BrandMark />
        <span className="font-heading text-lg font-bold">FacultyHub</span>
      </div>
      <h2 className="font-heading text-[28px] font-bold tracking-tight">Sign in</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Use your institutional account to access FacultyHub.</p>

      {params.get("reason") === "expired" && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Your session expired. Please sign in again.
        </div>
      )}
      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <FormField label="Email address" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="name@institution.edu" className="h-10" aria-invalid={!!errors.email} {...register("email")} />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className="h-10 pr-10" aria-invalid={!!errors.password} {...register("password")} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </FormField>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="h-10 w-full text-sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Sign in
        </Button>
      </form>

      {SHOW_DEMO && (
        <div className="mt-8 rounded-xl border border-dashed bg-muted/30 p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Demo accounts · development only</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Password: <code className="rounded bg-muted px-1 py-0.5 font-mono">{DEMO_PASSWORD}</code> — click to fill.
          </p>
          <div className="mt-3 grid gap-2">
            {DEMO.map((d) => (
              <button
                key={d.role}
                type="button"
                onClick={() => {
                  setValue("email", d.email, { shouldValidate: true });
                  setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                }}
                className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-500/10"
              >
                <span className="font-medium">{ROLE_LABELS[d.role]}</span>
                <span className="text-xs text-muted-foreground">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
