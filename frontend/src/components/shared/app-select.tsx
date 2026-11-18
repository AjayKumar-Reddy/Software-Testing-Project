"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
}

/** Thin wrapper over the Base UI select with a simple options API. Empty string = "no value". */
export function AppSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  disabled,
  id,
  invalid,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  /** When set, prepends an "all" option with value "". */
  allLabel?: string;
}) {
  const opts = allLabel ? [{ value: "__all__", label: allLabel }, ...options] : options;
  const current = value === "" && allLabel ? "__all__" : value;
  return (
    <Select
      value={current || null}
      onValueChange={(v) => onChange(v === "__all__" || v == null ? "" : String(v))}
      items={opts}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className={cn("h-9 w-full min-w-0 bg-background", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-72">
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
