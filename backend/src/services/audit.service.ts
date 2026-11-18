import type { Request } from "express";
import { AuditLog } from "../models";

interface AuditInput {
  action: string;
  module: string;
  recordId?: unknown;
  description?: string;
  user?: { id: string; name: string; role: string } | null;
}

/** Writes an audit log entry. Never throws — auditing must not break the request. */
export async function audit(req: Request | null, input: AuditInput): Promise<void> {
  try {
    const user = input.user ?? req?.user ?? null;
    await AuditLog.create({
      user: user?.id ?? null,
      userName: user?.name ?? "System",
      role: user?.role ?? "system",
      action: input.action,
      module: input.module,
      recordId: input.recordId ? String(input.recordId) : null,
      description: input.description ?? "",
      ip: req?.ip ?? "",
    });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}
