import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

import { LEGACY_UPLOAD_ROOT, UPLOADS_STORAGE_ROOT } from "lib/uploads";

export const runtime = "nodejs";

const UPLOAD_ROOTS = [UPLOADS_STORAGE_ROOT, LEGACY_UPLOAD_ROOT].filter(Boolean);

const getMimeType = (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".avif":
      return "image/avif";
    case ".bmp":
      return "image/bmp";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
};

const findExistingFile = async (relativePath: string) => {
  for (const root of UPLOAD_ROOTS) {
    const absolutePath = path.resolve(root, relativePath);
    if (!absolutePath.startsWith(root)) {
      continue;
    }

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isFile()) {
        return { absolutePath, stats } as const;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return null;
};

const buildHeaders = (filePath: string, size: number, lastModified: Date) => {
  const headers = new Headers();
  headers.set("Content-Type", getMimeType(filePath));
  headers.set("Content-Length", size.toString());
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  headers.set("Last-Modified", lastModified.toUTCString());
  headers.set("Accept-Ranges", "none");
  headers.set("Content-Disposition", "inline");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  return headers;
};

const normalizeSegments = (segments: string[]) => {
  return segments
    .map((segment) => decodeURIComponent(segment))
    .map((segment) => segment.replace(/\\+/g, "/"))
    .join("/");
};

const ensureValidPath = (relativePath: string) => {
  if (!relativePath || relativePath.includes("..")) {
    throw new Error("Caminho inválido.");
  }
};

const toWebStream = (filePath: string) => {
  const nodeStream = createReadStream(filePath);
  return Readable.toWeb(nodeStream) as unknown as ReadableStream;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: rawSegments } = await context.params;
    if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
      return NextResponse.json({ message: "Caminho inválido." }, { status: 400 });
    }

    const relativePath = normalizeSegments(rawSegments);
    ensureValidPath(relativePath);

    const file = await findExistingFile(relativePath);
    if (!file) {
      return NextResponse.json({ message: "Arquivo não encontrado." }, { status: 404 });
    }

    const headers = buildHeaders(file.absolutePath, file.stats.size, file.stats.mtime);
    const body = toWebStream(file.absolutePath);

    return new Response(body, { headers });
  } catch (error) {
    console.error("Failed to serve upload", error);
    return NextResponse.json({ message: "Erro ao carregar arquivo." }, { status: 500 });
  }
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: rawSegments } = await context.params;
    if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
      return NextResponse.json({ message: "Caminho inválido." }, { status: 400 });
    }

    const relativePath = normalizeSegments(rawSegments);
    ensureValidPath(relativePath);

    const file = await findExistingFile(relativePath);
    if (!file) {
      return NextResponse.json({ message: "Arquivo não encontrado." }, { status: 404 });
    }

    const headers = buildHeaders(file.absolutePath, file.stats.size, file.stats.mtime);
    return new Response(null, { headers });
  } catch (error) {
    console.error("Failed to resolve upload metadata", error);
    return NextResponse.json({ message: "Erro ao carregar arquivo." }, { status: 500 });
  }
}

