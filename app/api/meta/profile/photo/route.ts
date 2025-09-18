import { NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import {
  fetchMetaBusinessProfile,
  removeMetaProfilePicture,
  updateMetaProfilePictureHandle,
  uploadMetaProfilePicture,
} from "lib/meta-profile";
import { getWebhookRowForUser } from "lib/webhooks";

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const webhook = await getWebhookRowForUser(user.id);

    if (!webhook?.access_token || !webhook.phone_number_id) {
      return NextResponse.json(
        { message: "Configure o webhook da Meta antes de atualizar a foto." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const photo = formData.get("photo");

    if (!(photo instanceof File) || photo.size === 0) {
      return NextResponse.json(
        { message: "Selecione uma imagem válida para enviar." },
        { status: 400 },
      );
    }

    if (photo.size > MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { message: "A imagem deve ter no máximo 5 MB." },
        { status: 400 },
      );
    }

    const handle = await uploadMetaProfilePicture(webhook, photo);

    if (!handle) {
      return NextResponse.json(
        { message: "Não foi possível enviar a foto agora." },
        { status: 502 },
      );
    }

    const updated = await updateMetaProfilePictureHandle(webhook, handle);

    if (!updated) {
      return NextResponse.json(
        { message: "Não foi possível enviar a foto agora." },
        { status: 502 },
      );
    }

    const profile = await fetchMetaBusinessProfile(webhook);

    return NextResponse.json({
      message: "Foto atualizada com sucesso.",
      profile,
    });
  } catch (error) {
    console.error("Failed to upload Meta profile picture", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar a foto do perfil." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const webhook = await getWebhookRowForUser(user.id);

    if (!webhook?.access_token || !webhook.phone_number_id) {
      return NextResponse.json(
        { message: "Configure o webhook da Meta antes de remover a foto." },
        { status: 400 },
      );
    }

    const removed = await removeMetaProfilePicture(webhook);

    if (!removed) {
      return NextResponse.json(
        { message: "Não foi possível remover a foto agora." },
        { status: 502 },
      );
    }

    const profile = await fetchMetaBusinessProfile(webhook);

    return NextResponse.json({
      message: "Foto removida com sucesso.",
      profile,
    });
  } catch (error) {
    console.error("Failed to delete Meta profile picture", error);
    return NextResponse.json(
      { message: "Não foi possível remover a foto do perfil." },
      { status: 500 },
    );
  }
}
