import { NextRequest, NextResponse } from "next/server";

import {
  deleteProduct,
  getCategoryOwner,
  getProductOwner,
  updateProduct,
} from "lib/catalog";
import { getCurrentUser } from "lib/auth";
import { deleteUploadedFile, saveUploadedFile } from "lib/uploads";

const parseInteger = (value: FormDataEntryValue | null, fallback: number) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

    const productId = Number.parseInt(params.id, 10);
    if (Number.isNaN(productId)) {
      return NextResponse.json({ message: "Produto inválido." }, { status: 400 });
    }

    const existing = await getProductOwner(productId);
    if (!existing) {
      return NextResponse.json({ message: "Produto não encontrado." }, { status: 404 });
    }

    if (user.role !== "admin" && existing.user_id !== user.id) {
      return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
    }

    const formData = await request.formData();
    const name = formData.get("name");
    const categoryIdValue = formData.get("categoryId");
    const details = formData.get("details");
    const resaleLimitValue = formData.get("resaleLimit");
    const removeFile = formData.get("removeFile");
    const file = formData.get("file");

    const cleanedName =
      typeof name === "string" && name.trim().length ? name.trim() : existing.name;
    const cleanedDetails =
      typeof details === "string" && details.trim().length
        ? details.trim()
        : existing.details;

    let categoryId = existing.category_id;
    if (typeof categoryIdValue === "string") {
      const parsed = Number.parseInt(categoryIdValue, 10);
      if (!Number.isNaN(parsed)) {
        categoryId = parsed;
      }
    }

    const category = await getCategoryOwner(categoryId);
    if (!category) {
      return NextResponse.json({ message: "Categoria inválida." }, { status: 400 });
    }

    if (user.role !== "admin" && category.user_id !== user.id) {
      return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
    }

    const resaleLimit = parseInteger(resaleLimitValue, existing.resale_limit ?? 0);
    const shouldRemoveFile = removeFile === "true";
    let filePath = existing.file_path;

    if (file instanceof File && file.size > 0) {
      if (filePath) {
        await deleteUploadedFile(filePath);
      }
      filePath = await saveUploadedFile(file, "products");
    } else if (shouldRemoveFile && filePath) {
      await deleteUploadedFile(filePath);
      filePath = null;
    }

    await updateProduct(productId, {
      categoryId,
      name: cleanedName,
      details: cleanedDetails,
      filePath,
      resaleLimit,
    });

    return NextResponse.json({ message: "Produto atualizado." });
  } catch (error) {
    console.error("Failed to update product", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar o produto." },
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

    const productId = Number.parseInt(params.id, 10);
    if (Number.isNaN(productId)) {
      return NextResponse.json({ message: "Produto inválido." }, { status: 400 });
    }

    const existing = await getProductOwner(productId);
    if (!existing) {
      return NextResponse.json({ message: "Produto não encontrado." }, { status: 404 });
    }

    if (user.role !== "admin" && existing.user_id !== user.id) {
      return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
    }

    if (existing.file_path) {
      await deleteUploadedFile(existing.file_path);
    }

    await deleteProduct(productId);

    return NextResponse.json({ message: "Produto removido." });
  } catch (error) {
    console.error("Failed to delete product", error);
    return NextResponse.json(
      { message: "Não foi possível remover o produto." },
      { status: 500 },
    );
  }
}
