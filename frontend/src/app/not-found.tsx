import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10"><Compass className="size-7" /></span>
      <h1 className="font-heading text-3xl font-bold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      <Button render={<Link href="/dashboard" />}>Go to dashboard</Button>
    </div>
  );
}
