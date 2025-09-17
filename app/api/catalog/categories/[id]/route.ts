import { NextRequest, NextResponse } from "next/server";

import {
  deleteCategory,
  getCategoryOwner,
  updateCategory,
} from "lib/catalog";
import { getCurrentUser } from "lib/auth";
import { deleteUploadedFile, saveUploadedFile } from "lib/uploads";

const parsePrice = (value: FormDataEntryValue | null, fallback: number) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const sanitized = trimmed.replace(/[^0-9,.-]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(/,/g, ".")
    : sanitized;
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const categoryId = Number.parseInt(params.id, 10);
    if (Number.isNaN(categoryId)) {
      return NextResponse.json({ message: "Categoria inválida." }, { status: 400 });
    }

    const existing = await getCategoryOwner(categoryId);
    if (!existing) {
      return NextResponse.json({ message: "Categoria não encontrada." }, { status: 404 });
    }

    if (user.role !== "admin" && existing.user_id !== user.id) {
      return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
    }

    const formData = await request.formData();

    const name = formData.get("name");
    const sku = formData.get("sku");
    const description = formData.get("description");
    const status = formData.get("status");
    const removeImage = formData.get("removeImage");
    const image = formData.get("image");

    const cleanedName =
      typeof name === "string" && name.trim().length ? name.trim() : existing.name;
    const cleanedSku =
      typeof sku === "string" && sku.trim().length ? sku.trim() : existing.sku;
    const cleanedDescription =
      typeof description === "string"
        ? description.trim()
        : existing.description ?? "";
    const isActive =
      status === "inactive"
        ? false
        : status === "active"
          ? true
          : Boolean(existing.is_active);
    const price = parsePrice(formData.get("price"), Number(existing.price ?? 0));

    let imagePath = existing.image_path;
    const shouldRemoveImage = removeImage === "true";

    if (image instanceof File && image.size > 0) {
      if (imagePath) {
        await deleteUploadedFile(imagePath);
      }
      imagePath = await saveUploadedFile(image, "categories");
    } else if (shouldRemoveImage && imagePath) {
      await deleteUploadedFile(imagePath);
      imagePath = null;
    }

    await updateCategory(categoryId, {
      name: cleanedName,
      price,
      sku: cleanedSku,
      description: cleanedDescription,
      imagePath,
      isActive,
    });

    return NextResponse.json({ message: "Categoria atualizada." });
  } catch (error) {
    console.error("Failed to update category", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar a categoria." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const categoryId = Number.parseInt(params.id, 10);
    if (Number.isNaN(categoryId)) {
      return NextResponse.json({ message: "Categoria inválida." }, { status: 400 });
    }

    const existing = await getCategoryOwner(categoryId);
    if (!existing) {
      return NextResponse.json({ message: "Categoria não encontrada." }, { status: 404 });
    }

    if (user.role !== "admin" && existing.user_id !== user.id) {
      return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
    }

    if (existing.image_path) {
      await deleteUploadedFile(existing.image_path);
    }

    await deleteCategory(categoryId);

    return NextResponse.json({ message: "Categoria removida." });
  } catch (error) {
    console.error("Failed to delete category", error);
    return NextResponse.json(
      { message: "Não foi possível remover a categoria." },
      { status: 500 },
    );
  }
}
