import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

async function main() {
  await connectDB();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] FacultyHub API listening on http://localhost:${env.port}/api (${env.nodeEnv})`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
