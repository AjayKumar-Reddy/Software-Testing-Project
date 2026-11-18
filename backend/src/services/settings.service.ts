import { SystemSetting } from "../models";

type Settings = Awaited<ReturnType<typeof loadSettings>>;
let cache: { value: Settings; at: number } | null = null;

async function loadSettings() {
  const existing = await SystemSetting.findOne({ key: "global" }).lean();
  if (existing) return existing;
  await SystemSetting.updateOne({ key: "global" }, { $setOnInsert: { key: "global" } }, { upsert: true });
  return (await SystemSetting.findOne({ key: "global" }).lean())!;
}

/** Returns the singleton settings document (cached for 30s). */
export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const value = await loadSettings();
  cache = { value, at: Date.now() };
  return value;
}

export function invalidateSettings() {
  cache = null;
}
