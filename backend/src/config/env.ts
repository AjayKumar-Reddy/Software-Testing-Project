import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true } as dotenv.DotenvConfigOptions);

const isTest = process.env.NODE_ENV === "test";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest,
  port: Number(process.env.PORT ?? 5050),
  clientUrls: (process.env.CLIENT_URL ?? "http://localhost:3000").split(",").map((s) => s.trim()),
  mongoUri: isTest
    ? required("MONGO_URI_TEST", "mongodb://127.0.0.1:27017/facultyhub_test")
    : required("MONGO_URI", "mongodb://127.0.0.1:27017/facultyhub"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", isTest ? "test-access-secret" : undefined),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", isTest ? "test-refresh-secret" : undefined),
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 7),
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM ?? "FacultyHub <no-reply@facultyhub.local>",
  },
  uploadDir: path.resolve(__dirname, "../../uploads"),
  seedPassword: process.env.SEED_DEMO_PASSWORD ?? "Demo@123",
};
