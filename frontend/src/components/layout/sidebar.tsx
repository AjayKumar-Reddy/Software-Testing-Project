"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { NAV_SECTIONS, ROLE_LABELS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettings } from "@/hooks/use-settings";
import { BrandMark } from "./brand";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}

export function SidebarNav({ collapsed = false, onToggle, onNavigate, mobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { role, user } = useAuth();
  const { data: settings } = useSettings();
  if (!role) return null;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-16 items-center gap-3 border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        <BrandMark />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-heading text-[15px] font-bold leading-tight text-white">FacultyHub</p>
            <p className="truncate text-[11px] text-sidebar-foreground/70">{settings?.institutionName ?? "Faculty Management"}</p>
          </div>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => i.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={section.label}>
              {!collapsed && <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">{section.label}</p>}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const label = item.labels?.[role] ?? item.title;
                  const link = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-150",
                        active ? "bg-sidebar-primary text-white shadow-md shadow-blue-950/40" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon className={cn("size-[18px] shrink-0", active ? "text-white" : "text-sidebar-foreground/60 group-hover:text-white")} />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  );
                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
                          <TooltipContent side="right">{label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <div className="mb-2 rounded-lg bg-sidebar-accent px-3 py-2.5">
            <p className="text-[11px] text-sidebar-foreground/60">Signed in as</p>
            <p className="truncate text-xs font-semibold text-white">{ROLE_LABELS[user.role]}</p>
            {user.faculty?.department && <p className="truncate text-[11px] text-sidebar-foreground/70">{user.faculty.department.name}</p>}
          </div>
        )}
        {!mobile && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
          </button>
        )}
      </div>
    </div>
  );
}
