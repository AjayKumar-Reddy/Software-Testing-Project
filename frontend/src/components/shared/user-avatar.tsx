import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { assetUrl, cn, initials } from "@/lib/utils";

const TONES = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700"];

export function UserAvatar({ name, photo, className }: { name?: string | null; photo?: string | null; className?: string }) {
  const tone = TONES[(name ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return (
    <Avatar className={cn("size-9", className)}>
      {photo ? <AvatarImage src={assetUrl(photo)} alt={name ?? ""} className="object-cover" /> : null}
      <AvatarFallback className={cn("text-xs font-semibold dark:bg-muted dark:text-foreground", tone)}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
