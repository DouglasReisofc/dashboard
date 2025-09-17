import { NextRequest, NextResponse } from "next/server";

import { getAllProducts, getCategoryOwner, getProductsForUser, insertProduct } from "lib/catalog";
import type { AdminProductSummary, ProductSummary } from "types/catalog";
import { ensureProductTable } from "lib/db";
import { getCurrentUser } from "lib/auth";
import { saveUploadedFile } from "lib/uploads";

const parseInteger = (value: FormDataEntryValue | null, fallback = 0) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    await ensureProductTable();

    const scope = request.nextUrl.searchParams.get("scope");

    if (user.role === "admin" && scope === "all") {
      const products = await getAllProducts();
      return NextResponse.json<{ products: AdminProductSummary[] }>({ products });
    }

    const products = await getProductsForUser(user.id);
    return NextResponse.json<{ products: ProductSummary[] }>({ products });
  } catch (error) {
    console.error("Failed to fetch products", error);
    return NextResponse.json(
      { message: "Não foi possível carregar os produtos." },
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
    const categoryIdValue = formData.get("categoryId");
    const details = formData.get("details");
    const resaleLimitValue = formData.get("resaleLimit");
    const file = formData.get("file");

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { message: "Informe um nome para o produto." },
        { status: 400 },
      );
    }

    if (typeof categoryIdValue !== "string") {
      return NextResponse.json(
        { message: "Selecione uma categoria." },
        { status: 400 },
      );
    }

    const categoryId = Number.parseInt(categoryIdValue, 10);
    if (Number.isNaN(categoryId)) {
      return NextResponse.json(
        { message: "Categoria inválida." },
        { status: 400 },
      );
    }

    const category = await getCategoryOwner(categoryId);
    if (!category) {
      return NextResponse.json(
        { message: "Categoria não encontrada." },
        { status: 404 },
      );
    }

    if (user.role !== "admin" && category.user_id !== user.id) {
      return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
    }

    if (typeof details !== "string" || !details.trim()) {
      return NextResponse.json(
        { message: "Adicione o conteúdo secreto em detalhes." },
        { status: 400 },
      );
    }

    const resaleLimit = parseInteger(resaleLimitValue, 0);
    const cleanedName = name.trim();
    const cleanedDetails = details.trim();

    let filePath: string | null = null;
    if (file instanceof File && file.size > 0) {
      filePath = await saveUploadedFile(file, "products");
    }

    const productId = await insertProduct({
      userId: user.id,
      categoryId,
      name: cleanedName,
      details: cleanedDetails,
      filePath,
      resaleLimit,
    });

    return NextResponse.json(
      { message: "Produto cadastrado com sucesso.", id: productId },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create product", error);
    return NextResponse.json(
      { message: "Não foi possível cadastrar o produto." },
      { status: 500 },
    );
  }
}
