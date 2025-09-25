import { NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { getDb } from "lib/db";
import { getMetaApiVersion } from "lib/meta";

export async function GET(
  _request: Request,
  context: { params: Promise<{ mediaId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const { mediaId } = await context.params;
    if (!mediaId) {
      return NextResponse.json({ message: "MediaId inválido." }, { status: 400 });
    }

    const db = getDb();
    const [rows] = await db.query<
      Array<{ access_token: string | null }>
    >(
      "SELECT access_token FROM user_webhooks WHERE user_id = ? LIMIT 1",
      [user.id],
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    const accessToken = row?.access_token?.trim() || "";
    if (!accessToken) {
      return NextResponse.json({ message: "Configure o Access Token do Webhook." }, { status: 400 });
    }

    const version = getMetaApiVersion();
    const metadataRes = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const metadata = await metadataRes.json().catch(() => null);
    if (!metadataRes.ok || !metadata?.url) {
      const message = metadata?.error?.message ?? "Falha ao obter metadados do arquivo.";
      return NextResponse.json({ message }, { status: metadataRes.status });
    }

    const mediaResponse = await fetch(metadata.url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mediaResponse.ok || !mediaResponse.body) {
      return NextResponse.json(
        { message: "Não foi possível baixar o arquivo de mídia." },
        { status: mediaResponse.status },
      );
    }

    const mimeType = metadata.mime_type ?? mediaResponse.headers.get("Content-Type") ?? "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    if (metadata.file_size) {
      headers.set("Content-Length", String(metadata.file_size));
    }
    if (metadata.id) {
      headers.set("Content-Disposition", `inline; filename="${metadata.id}"`);
    }

    return new Response(mediaResponse.body, { headers });
  } catch (error) {
    console.error("Failed to proxy media", error);
    return NextResponse.json(
      { message: "Erro ao recuperar arquivo de mídia." },
      { status: 500 },
    );
  }
}
