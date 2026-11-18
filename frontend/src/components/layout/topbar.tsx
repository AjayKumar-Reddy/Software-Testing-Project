"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { KeyRound, LogOut, Menu, Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_LABELS } from "@/lib/navigation";
import { UserAvatar } from "@/components/shared/user-avatar";
import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { useRouter } from "next/navigation";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const name = user?.faculty ? `${user.faculty.firstName} ${user.faculty.lastName}` : user?.name;

  return (
    <header data-slot="app-topbar" className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/70 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu className="size-5" />
      </Button>
      <div className="flex flex-1 items-center">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle dark mode"
        >
          <Sun className="size-[18px] dark:hidden" />
          <Moon className="hidden size-[18px] dark:block" />
        </Button>
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className="ml-1 flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition hover:bg-muted" aria-label="Account menu" />}>
            <UserAvatar name={name} photo={user?.faculty?.photo} className="size-8" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold">{name}</span>
              <span className="block text-[11px] text-muted-foreground">{user ? ROLE_LABELS[user.role] : ""}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                <p className="truncate text-xs font-normal">{user?.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="size-4" /> My profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/profile?tab=security")}>
                <KeyRound className="size-4" /> Change password
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => logout()}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Link href="/profile" className="sr-only">Profile</Link>
    </header>
  );
}
