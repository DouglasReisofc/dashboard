import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

const getAppBaseUrl = () => {
  const rawUrl = process.env.APP_URL?.trim();

  if (!rawUrl) {
    return "http://localhost:4478";
  }

  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
};

const uploadRoot = path.resolve(process.cwd(), "public", "uploads");

const ensureFolder = async (folder: string) => {
  const folderPath = path.resolve(uploadRoot, folder);
  if (!folderPath.startsWith(uploadRoot)) {
    throw new Error("Invalid upload destination");
  }

  await fs.mkdir(folderPath, { recursive: true });
  return folderPath;
};

export const saveUploadedFile = async (file: File, folder: string) => {
  if (!(file instanceof File)) {
    throw new Error("Invalid file payload");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name) || "";
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "");
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const filename = `${Date.now()}-${uniqueId}${safeExtension}`;

  const folderPath = await ensureFolder(folder);
  const destination = path.join(folderPath, filename);

  await fs.writeFile(destination, buffer);

  return path.posix.join("uploads", folder.replace(/\\/g, "/"), filename);
};

export const resolveUploadedFileUrl = (relativePath: string) => {
  const normalized = relativePath.replace(/^\/+/, "");

  return `${getAppBaseUrl()}/${normalized}`;
};

export const deleteUploadedFile = async (relativePath?: string | null) => {
  if (!relativePath) {
    return;
  }

  const normalized = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized.startsWith("uploads/")) {
    return;
  }

  const absolute = path.resolve(process.cwd(), "public", normalized);
  const allowedRoot = path.resolve(process.cwd(), "public", "uploads");

  if (!absolute.startsWith(allowedRoot)) {
    return;
  }

  try {
    await fs.unlink(absolute);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};
