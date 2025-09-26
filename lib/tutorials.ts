import {
  FieldTutorialRow,
  ensureFieldTutorialTable,
  getDb,
} from "lib/db";
import {
  deleteUploadedFile,
  resolveUploadedFileUrl,
  saveUploadedFile,
} from "lib/uploads";
import type {
  FieldTutorial,
  FieldTutorialMap,
  WebhookTutorialFieldKey,
} from "types/tutorials";
import { WEBHOOK_TUTORIAL_FIELDS, WEBHOOK_TUTORIAL_SLUG_BY_KEY } from "types/tutorials";

const mapRowToTutorial = (row: FieldTutorialRow): FieldTutorial => ({
  slug: row.slug,
  title: row.title,
  description: row.description,
  mediaUrl: row.media_path ? resolveUploadedFileUrl(row.media_path) : null,
  mediaPath: row.media_path,
  mediaType: row.media_type ?? null,
  updatedAt: row.updated_at.toISOString(),
});

export const getAllFieldTutorials = async (): Promise<FieldTutorial[]> => {
  await ensureFieldTutorialTable();
  const db = getDb();
  const [rows] = await db.query<FieldTutorialRow[]>(
    "SELECT * FROM field_tutorials ORDER BY slug ASC",
  );

  return rows.map(mapRowToTutorial);
};

export const getFieldTutorialsBySlugs = async (
  slugs: string[],
): Promise<FieldTutorialMap> => {
  if (!Array.isArray(slugs) || slugs.length === 0) {
    return {};
  }

  await ensureFieldTutorialTable();
  const db = getDb();
  const placeholders = slugs.map(() => "?").join(", ");
  const [rows] = await db.query<FieldTutorialRow[]>(
    `SELECT * FROM field_tutorials WHERE slug IN (${placeholders})`,
    slugs,
  );

  return rows.reduce<FieldTutorialMap>((accumulator, row) => {
    accumulator[row.slug] = mapRowToTutorial(row);
    return accumulator;
  }, {});
};

export const getWebhookTutorials = async (): Promise<FieldTutorialMap> => {
  const slugs = WEBHOOK_TUTORIAL_FIELDS.map((field) => field.slug);
  return getFieldTutorialsBySlugs(slugs);
};

type UpsertFieldTutorialInput = {
  slug: string;
  title: string;
  description: string;
  mediaType?: "image" | "video" | null;
  mediaFile?: File | null;
  removeMedia?: boolean;
};

const detectMediaType = (file: File | null | undefined) => {
  if (!file) {
    return null;
  }

  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("video/")) {
    return "video" as const;
  }

  if (mime.startsWith("image/")) {
    return "image" as const;
  }

  return null;
};

export const upsertFieldTutorial = async ({
  slug,
  title,
  description,
  mediaType,
  mediaFile,
  removeMedia,
}: UpsertFieldTutorialInput): Promise<FieldTutorial> => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    throw new Error("Slug inválido");
  }

  await ensureFieldTutorialTable();
  const db = getDb();

  const [existingRows] = await db.query<FieldTutorialRow[]>(
    "SELECT * FROM field_tutorials WHERE slug = ? LIMIT 1",
    [normalizedSlug],
  );
  const existing = existingRows.length ? existingRows[0] : null;

  let mediaPath = existing?.media_path ?? null;
  let nextMediaType: "image" | "video" | null = existing?.media_type ?? null;

  const sanitizedTitle = title.trim();
  const sanitizedDescription = description.trim();

  if (!sanitizedTitle) {
    throw new Error("Informe um título válido para o tutorial.");
  }

  if (!sanitizedDescription) {
    throw new Error("Informe uma descrição válida para o tutorial.");
  }

  if (mediaFile && mediaFile.size > 0) {
    if (mediaPath) {
      await deleteUploadedFile(mediaPath);
    }

    const detectedType = detectMediaType(mediaFile);
    const targetType = mediaType ?? detectedType ?? null;
    const uploadsFolder = `tutorials/${normalizedSlug}`;
    const storedPath = await saveUploadedFile(mediaFile, uploadsFolder, {
      convertToWebp: targetType === "image",
    });

    mediaPath = storedPath;
    nextMediaType = targetType;
  } else if (removeMedia && mediaPath) {
    await deleteUploadedFile(mediaPath);
    mediaPath = null;
    nextMediaType = null;
  } else if (typeof mediaType === "string" && mediaType) {
    nextMediaType = mediaType === "video" ? "video" : "image";
  }

  if (existing) {
    await db.query(
      `
        UPDATE field_tutorials
        SET title = ?, description = ?, media_path = ?, media_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE slug = ?
      `,
      [sanitizedTitle, sanitizedDescription, mediaPath, nextMediaType, normalizedSlug],
    );
  } else {
    await db.query(
      `
        INSERT INTO field_tutorials (slug, title, description, media_path, media_type)
        VALUES (?, ?, ?, ?, ?)
      `,
      [normalizedSlug, sanitizedTitle, sanitizedDescription, mediaPath, nextMediaType],
    );
  }

  const [rows] = await db.query<FieldTutorialRow[]>(
    "SELECT * FROM field_tutorials WHERE slug = ? LIMIT 1",
    [normalizedSlug],
  );

  if (!rows.length) {
    throw new Error("Não foi possível salvar o tutorial.");
  }

  return mapRowToTutorial(rows[0]);
};

export const deleteFieldTutorial = async (slug: string) => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return;
  }

  await ensureFieldTutorialTable();
  const db = getDb();

  const [rows] = await db.query<FieldTutorialRow[]>(
    "SELECT * FROM field_tutorials WHERE slug = ? LIMIT 1",
    [normalizedSlug],
  );

  if (!rows.length) {
    return;
  }

  const tutorial = rows[0];

  if (tutorial.media_path) {
    await deleteUploadedFile(tutorial.media_path);
  }

  await db.query("DELETE FROM field_tutorials WHERE slug = ?", [normalizedSlug]);
};

export const getWebhookTutorialByKey = async (
  key: WebhookTutorialFieldKey,
): Promise<FieldTutorial | null> => {
  const slug = WEBHOOK_TUTORIAL_SLUG_BY_KEY[key];
  if (!slug) {
    return null;
  }

  const tutorials = await getFieldTutorialsBySlugs([slug]);
  return tutorials[slug] ?? null;
};
