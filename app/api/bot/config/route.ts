import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { getBotMenuConfigForUser, upsertBotMenuConfig } from "lib/bot-config";
import { deleteUploadedFile, saveUploadedFile } from "lib/uploads";

const normalizeVariables = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return [] as string[];
  }

  return value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);
};

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const config = await getBotMenuConfigForUser(user.id);

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Failed to load bot menu configuration", error);
    return NextResponse.json(
      { message: "Não foi possível carregar a configuração do bot." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const formData = await request.formData();
    const menuTextRaw = formData.get("menuText");
    const variablesRaw = formData.get("variables");
    const removeImage = (formData.get("removeImage") ?? "") === "true";
    const image = formData.get("image");

    if (typeof menuTextRaw !== "string" || !menuTextRaw.trim()) {
      return NextResponse.json(
        { message: "Informe o texto que será enviado no menu principal." },
        { status: 400 },
      );
    }

    const menuText = menuTextRaw.trim();
    const variables = normalizeVariables(variablesRaw);

    if (image && !(image instanceof File)) {
      return NextResponse.json(
        { message: "Arquivo de mídia inválido." },
        { status: 400 },
      );
    }

    const existingConfig = await getBotMenuConfigForUser(user.id);
    let imagePath = existingConfig?.imagePath ?? null;

    if (removeImage && imagePath) {
      await deleteUploadedFile(imagePath);
      imagePath = null;
    }

    if (image instanceof File && image.size > 0) {
      const storedPath = await saveUploadedFile(image, `bot-configs/${user.id}`);
      if (imagePath && imagePath !== storedPath) {
        await deleteUploadedFile(imagePath);
      }
      imagePath = storedPath;
    }

    const config = await upsertBotMenuConfig({
      userId: user.id,
      menuText,
      variables,
      imagePath,
    });

    return NextResponse.json({
      message: "Configuração do bot atualizada com sucesso.",
      config,
    });
  } catch (error) {
    console.error("Failed to update bot menu configuration", error);
    return NextResponse.json(
      { message: "Não foi possível salvar a configuração do bot." },
      { status: 500 },
    );
  }
}
