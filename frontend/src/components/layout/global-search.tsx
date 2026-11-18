"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Building2, Search, User } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { get } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/contexts/auth-context";
import { NAV_SECTIONS } from "@/lib/navigation";

interface SearchResult {
  faculty: { _id: string; fullName: string; facultyId: string; designation: string }[];
  departments: { _id: string; name: string; code: string }[];
  subjects: { _id: string; name: string; code: string; semester: number }[];
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const q = useDebounce(term, 250);
  const router = useRouter();
  const { role } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => get<SearchResult>("/search", { q }),
    enabled: open && q.trim().length >= 2,
  });

  const go = (href: string) => {
    setOpen(false);
    setTerm("");
    router.push(href);
  };

  const pages = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => role && i.roles.includes(role) && (!term || i.title.toLowerCase().includes(term.toLowerCase())));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition hover:bg-muted md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search faculty, subjects…</span>
        <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      <button type="button" onClick={() => setOpen(true)} className="flex size-9 items-center justify-center rounded-full hover:bg-muted md:hidden" aria-label="Search">
        <Search className="size-[18px]" />
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search FacultyHub" description="Search faculty, departments, subjects and pages" className="sm:max-w-lg">
        <CommandInputWrapper value={term} onChange={setTerm} />
        <CommandList className="max-h-[380px]">
          <CommandEmpty>{isFetching ? "Searching…" : q.length < 2 ? "Type at least 2 characters" : "No results found."}</CommandEmpty>
          {pages.length > 0 && (
            <CommandGroup heading="Pages">
              {pages.slice(0, 5).map((p) => (
                <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                  <p.icon className="size-4 text-muted-foreground" /> {p.labels?.[role!] ?? p.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!data?.faculty.length && (
            <CommandGroup heading="Faculty">
              {data.faculty.map((f) => (
                <CommandItem key={f._id} value={`f-${f._id}`} onSelect={() => go(`/faculty/${f._id}`)}>
                  <User className="size-4 text-muted-foreground" />
                  <span>{f.fullName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{f.facultyId} · {f.designation}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!data?.departments.length && (
            <CommandGroup heading="Departments">
              {data.departments.map((d) => (
                <CommandItem key={d._id} value={`d-${d._id}`} onSelect={() => go(role === "faculty" ? "/dashboard" : `/departments/${d._id}`)}>
                  <Building2 className="size-4 text-muted-foreground" /> {d.name}
                  <span className="ml-auto text-xs text-muted-foreground">{d.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!data?.subjects.length && (
            <CommandGroup heading="Subjects">
              {data.subjects.map((s) => (
                <CommandItem key={s._id} value={`s-${s._id}`} onSelect={() => go(`/subjects?search=${encodeURIComponent(s.code)}`)}>
                  <BookOpen className="size-4 text-muted-foreground" /> {s.name}
                  <span className="ml-auto text-xs text-muted-foreground">{s.code} · Sem {s.semester}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function CommandInputWrapper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <CommandInput placeholder="Search faculty, departments, subjects…" value={value} onValueChange={onChange} />;
}
