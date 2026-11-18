"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Gauge, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { BrandMark } from "@/components/layout/brand";
import { get } from "@/lib/api";
import { assetUrl } from "@/lib/utils";

const FEATURES = [
  { icon: Users, title: "Faculty records", text: "Profiles, qualifications and teaching history in one place." },
  { icon: CalendarCheck, title: "Attendance & leave", text: "Daily attendance, leave approvals and balances with full audit trails." },
  { icon: Gauge, title: "Workload intelligence", text: "Balanced teaching loads with timetable conflict detection." },
  { icon: ShieldCheck, title: "Role-based security", text: "Separate access for administrators, HODs and faculty." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const { data: branding } = useQuery({
    queryKey: ["settings-public"],
    queryFn: () => get<{ institutionName: string; institutionShortName: string; institutionLogo?: string }>("/settings/public"),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (status !== "authenticated") return;
    // Honour ?next= (only same-origin relative paths) so users return to where they were.
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }, [status, router]);

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0b1638] text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.25),transparent_50%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        />
        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            {branding?.institutionLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(branding.institutionLogo)} alt="" className="size-10 rounded-xl bg-white object-contain p-1" />
            ) : (
              <BrandMark className="size-10" />
            )}
            <div>
              <p className="font-heading text-lg font-bold">FacultyHub</p>
              <p className="text-xs text-blue-200/80">{branding?.institutionName ?? "Faculty Management System"}</p>
            </div>
          </div>

          <div className="max-w-lg">
            <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-100">Academic administration, simplified</p>
            <h1 className="font-heading text-4xl leading-[1.15] font-bold tracking-tight xl:text-[44px]">
              Every faculty record, schedule and approval —{" "}
              <span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">in one place.</span>
            </h1>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <f.icon className="size-[18px] text-sky-300" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-blue-100/70">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-blue-200/60">© {new Date().getFullYear()} {branding?.institutionName ?? "FacultyHub"}. All rights reserved.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
