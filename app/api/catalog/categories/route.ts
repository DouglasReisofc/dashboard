import { NextRequest, NextResponse } from "next/server";

import { getAllCategories, getCategoriesForUser, insertCategory } from "lib/catalog";
import type { AdminCategorySummary, CategorySummary } from "types/catalog";
import { ensureCategoryTable } from "lib/db";
import { getCurrentUser } from "lib/auth";
import { saveUploadedFile } from "lib/uploads";

const parsePrice = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return 0;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const sanitized = trimmed.replace(/[^0-9,.-]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(/,/g, ".")
    : sanitized;
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    await ensureCategoryTable();

    const scope = request.nextUrl.searchParams.get("scope");

    if (user.role === "admin" && scope === "all") {
      const categories = await getAllCategories();
      return NextResponse.json<{ categories: AdminCategorySummary[] }>({
        categories,
      });
    }

    const categories = await getCategoriesForUser(user.id);
    return NextResponse.json<{ categories: CategorySummary[] }>({
      categories,
    });
  } catch (error) {
    console.error("Failed to fetch categories", error);
    return NextResponse.json(
      { message: "Não foi possível carregar as categorias." },
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
    const name = formData.get("name");
    const sku = formData.get("sku");
    const description = formData.get("description") ?? "";
    const price = parsePrice(formData.get("price"));
    const status = formData.get("status");
    const image = formData.get("image");

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { message: "Informe um nome para a categoria." },
        { status: 400 },
      );
    }

    if (typeof sku !== "string" || !sku.trim()) {
      return NextResponse.json(
        { message: "Informe um SKU para a categoria." },
        { status: 400 },
      );
    }

    const cleanedName = name.trim();
    const cleanedSku = sku.trim();
    const cleanedDescription = typeof description === "string" ? description.trim() : "";
    const isActive = status === "inactive" ? false : true;

    let imagePath: string | null = null;
    if (image instanceof File && image.size > 0) {
      imagePath = await saveUploadedFile(image, "categories");
    }

    const categoryId = await insertCategory({
      userId: user.id,
      name: cleanedName,
      price,
      sku: cleanedSku,
      description: cleanedDescription,
      imagePath,
      isActive,
    });

    return NextResponse.json(
      {
        message: "Categoria criada com sucesso.",
        id: categoryId,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Failed to create category", error);
    return NextResponse.json(
      { message: "Não foi possível criar a categoria." },
      { status: 500 },
    );
  }
}
