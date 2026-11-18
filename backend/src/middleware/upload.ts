import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { env } from "../config/env";
import { ApiError } from "../utils/http";

function storage(folder: string) {
  const dir = path.join(env.uploadDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  });
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOC_TYPES = [...IMAGE_TYPES, "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

function filter(allowed: string[]) {
  return (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  };
}

export const uploadAvatar = multer({ storage: storage("avatars"), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: filter(IMAGE_TYPES) });
export const uploadLogo = multer({ storage: storage("logos"), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: filter(IMAGE_TYPES) });
export const uploadDocument = multer({ storage: storage("documents"), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: filter(DOC_TYPES) });
