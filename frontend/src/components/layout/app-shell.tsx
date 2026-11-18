"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ROUTE_ROLES } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";
import { BrandMark } from "./brand";
import { AccessDenied } from "@/components/shared/states";

const STORAGE_KEY = "fh:sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <BrandMark className="size-12" />
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rule = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));
  const allowed = !rule || (role && rule.roles.includes(role));

  return (
    <div className="min-h-screen bg-background">
      <aside
        data-slot="app-sidebar"
        className={cn("fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-[264px]")}
      >
        <SidebarNav collapsed={collapsed} onToggle={toggle} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] border-0 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{allowed ? children : <AccessDenied />}</main>
      </div>
    </div>
  );
}
