"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { apiError, post } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function PhotoUpload({ facultyId, name, photo, editable = true, className }: { facultyId: string; name: string; photo?: string; editable?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { reloadUser, user } = useAuth();
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("photo", file);
      return post(`/faculty/${facultyId}/photo`, fd);
    },
    onSuccess: async () => {
      toast.success("Profile photo updated");
      qc.invalidateQueries({ queryKey: ["faculty"] });
      if (user?.faculty?._id === facultyId) await reloadUser();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className={cn("relative inline-block", className)}>
      <UserAvatar name={name} photo={photo} className="size-24 text-xl ring-4 ring-card" />
      {editable && (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={upload.isPending}
            className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card transition hover:scale-105"
            aria-label="Upload profile photo"
          >
            {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2 * 1024 * 1024) return toast.error("Image must be 2 MB or smaller");
              upload.mutate(f);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
