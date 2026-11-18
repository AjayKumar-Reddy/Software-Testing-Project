"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  description?: string;
}

/** Searchable dropdown (single or multi select). */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  multiple,
  className,
  invalid,
  disabled,
  clearable,
}: {
  options: ComboOption[];
  value: string | string[];
  onChange: (value: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  placeholder?: string;
  searchPlaceholder?: string;
  multiple?: boolean;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const labels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const toggle = (v: string) => {
    if (multiple) {
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    } else {
      onChange(v === value ? "" : v);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            data-invalid={invalid || undefined}
            className={cn(
              "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm transition outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 data-[invalid]:border-destructive",
              className,
            )}
          />
        }
      >
        <span className={cn("truncate", !labels.length && "text-muted-foreground")}>
          {labels.length ? (multiple && labels.length > 2 ? `${labels.length} selected` : labels.join(", ")) : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {clearable && selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onChange(multiple ? [] : "");
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const opt = options.find((o) => o.value === itemValue);
            const hay = `${opt?.label ?? ""} ${opt?.description ?? ""}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-64">
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.value} onSelect={() => toggle(o.value)} data-checked={selected.includes(o.value) || undefined}>
                  <Check className={cn("size-4", selected.includes(o.value) ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.description && <span className="block truncate text-xs text-muted-foreground">{o.description}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
