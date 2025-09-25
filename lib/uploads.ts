import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

export const UPLOADS_STORAGE_ROOT = path.resolve(process.cwd(), "storage", "uploads");
export const LEGACY_UPLOAD_ROOT = path.resolve(process.cwd(), "public", "uploads");
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";

const ensureFolder = async (folder: string) => {
  const folderPath = path.resolve(UPLOADS_STORAGE_ROOT, folder);
  if (!folderPath.startsWith(UPLOADS_STORAGE_ROOT)) {
    throw new Error("Invalid upload destination");
  }

  await fs.mkdir(folderPath, { recursive: true });
  return folderPath;
};

const shouldConvertToWebp = (mime: string) => {
  if (!mime.startsWith("image/")) {
    return false;
  }

  const normalized = mime.toLowerCase();
  if (normalized === "image/svg+xml" || normalized === "image/gif") {
    return false;
  }

  // Preserve PNG/JPEG/WebP in original format when requested
  if (normalized === "image/png" || normalized === "image/jpeg" || normalized === "image/webp") {
    return false;
  }

  return true;
};

type SaveUploadedFileOptions = {
  convertToWebp?: boolean;
};

export const saveUploadedFile = async (
  file: File,
  folder: string,
  options?: SaveUploadedFileOptions,
) => {
  if (!(file instanceof File)) {
    throw new Error("Invalid file payload");
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const extension = (path.extname(file.name) || "").toLowerCase();
  const safeExtension = extension.replace(/[^a-z0-9.]/g, "");
  const mimeType = (file.type || "").toLowerCase();
  let targetExtension = safeExtension;
  let buffer = originalBuffer;

  const allowConversion = options?.convertToWebp !== false;

  if (allowConversion && shouldConvertToWebp(mimeType)) {
    try {
      buffer = await sharp(originalBuffer).webp({ quality: 92 }).toBuffer();
      targetExtension = ".webp";
    } catch (error) {
      console.error("Failed to convert uploaded image to WebP", error);
      targetExtension = safeExtension || ".bin";
      buffer = originalBuffer;
    }
  } else if (!targetExtension) {
    targetExtension = mimeType.startsWith("image/") ? ".webp" : ".bin";
  }

  if (!targetExtension.startsWith(".")) {
    targetExtension = `.${targetExtension}`;
  }

  const uniqueId = crypto.randomBytes(8).toString("hex");
  const filename = `${Date.now()}-${uniqueId}${targetExtension}`;

  const folderPath = await ensureFolder(folder);
  const destination = path.join(folderPath, filename);

  await fs.writeFile(destination, buffer);

  return path.posix.join("uploads", folder.replace(/\\/g, "/"), filename);
};

export const resolveUploadedFileUrl = (relativePath: string) => {
  const normalized = relativePath.replace(/^\/+/, "");
  const prefix = BASE_PATH && BASE_PATH !== "/"
    ? (BASE_PATH.startsWith("/") ? BASE_PATH : `/${BASE_PATH}`)
    : "";

  const combined = `${prefix ? prefix : ""}/${normalized}`;
  return combined.replace(/\\/g, "/");
};

export const deleteUploadedFile = async (relativePath?: string | null) => {
  if (!relativePath) {
    return;
  }

  const normalized = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized.startsWith("uploads/")) {
    return;
  }

  const relative = normalized.slice("uploads/".length);
  const candidateRoots = [UPLOADS_STORAGE_ROOT, LEGACY_UPLOAD_ROOT];

  for (const root of candidateRoots) {
    if (!root) {
      continue;
    }

    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(root)) {
      continue;
    }

    try {
      await fs.unlink(absolute);
      return;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
};
