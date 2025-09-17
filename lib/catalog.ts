import { ResultSetHeader } from "mysql2";

import type {
  AdminCategorySummary,
  AdminProductSummary,
  CategorySummary,
  ProductSummary,
} from "types/catalog";

import {
  CategoryRow,
  ProductRow,
  ensureCategoryTable,
  ensureProductTable,
  getDb,
} from "./db";

const mapCategoryRow = (
  row: CategoryRow & {
    product_count?: number | null;
    owner_name?: string | null;
    owner_email?: string | null;
  },
): CategorySummary | AdminCategorySummary => {
  const base: CategorySummary = {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    price: Number(row.price ?? 0),
    sku: row.sku,
    description: row.description ?? "",
    imagePath: row.image_path,
    isActive: Boolean(row.is_active),
    productCount: Number(row.product_count ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };

  if (row.owner_name || row.owner_email) {
    return {
      ...base,
      ownerName: row.owner_name ?? "",
      ownerEmail: row.owner_email ?? "",
    } satisfies AdminCategorySummary;
  }

  return base satisfies CategorySummary;
};

const mapProductRow = (
  row: ProductRow & {
    category_name?: string | null;
    owner_name?: string | null;
    owner_email?: string | null;
  },
): ProductSummary | AdminProductSummary => {
  const base: ProductSummary = {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    categoryName: row.category_name ?? "",
    details: row.details,
    filePath: row.file_path,
    resaleLimit: Number(row.resale_limit ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };

  if (row.owner_name || row.owner_email) {
    return {
      ...base,
      ownerName: row.owner_name ?? "",
      ownerEmail: row.owner_email ?? "",
    } satisfies AdminProductSummary;
  }

  return base satisfies ProductSummary;
};

export const getCategoriesForUser = async (userId: number): Promise<CategorySummary[]> => {
  await ensureCategoryTable();
  const db = getDb();

  const [rows] = await db.query<
    (CategoryRow & { product_count: number })[]
  >(
    `
      SELECT c.*, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `,
    [userId],
  );

  return rows.map((row) => mapCategoryRow(row) as CategorySummary);
};

export const getCategoryByIdForUser = async (
  userId: number,
  categoryId: number,
): Promise<CategorySummary | null> => {
  await ensureCategoryTable();
  const db = getDb();

  const [rows] = await db.query<
    (CategoryRow & { product_count: number })[]
  >(
    `
      SELECT c.*, (
        SELECT COUNT(p.id)
        FROM products p
        WHERE p.category_id = c.id
      ) AS product_count
      FROM categories c
      WHERE c.user_id = ? AND c.id = ?
      LIMIT 1
    `,
    [userId, categoryId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapCategoryRow(rows[0]) as CategorySummary;
};

export const getAllCategories = async (): Promise<AdminCategorySummary[]> => {
  await ensureCategoryTable();
  const db = getDb();

  const [rows] = await db.query<
    (CategoryRow & {
      product_count: number;
      owner_name: string;
      owner_email: string;
    })[]
  >(
    `
      SELECT c.*, COUNT(p.id) AS product_count, u.name AS owner_name, u.email AS owner_email
      FROM categories c
      INNER JOIN users u ON u.id = c.user_id
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `,
  );

  return rows.map((row) => mapCategoryRow(row) as AdminCategorySummary);
};

export const getProductsForUser = async (userId: number): Promise<ProductSummary[]> => {
  await ensureProductTable();
  const db = getDb();

  const [rows] = await db.query<
    (ProductRow & { category_name: string })[]
  >(
    `
      SELECT p.*, c.name AS category_name
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `,
    [userId],
  );

  return rows.map((row) => mapProductRow(row) as ProductSummary);
};

export const findAvailableProductForCategory = async (
  userId: number,
  categoryId: number,
): Promise<ProductSummary | null> => {
  await ensureProductTable();
  const db = getDb();

  const [rows] = await db.query<
    (ProductRow & { category_name: string })[]
  >(
    `
      SELECT p.*, c.name AS category_name
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      WHERE p.user_id = ? AND p.category_id = ? AND p.resale_limit > 0
      ORDER BY p.updated_at ASC, p.id ASC
      LIMIT 1
    `,
    [userId, categoryId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapProductRow(rows[0]) as ProductSummary;
};

export const getAllProducts = async (): Promise<AdminProductSummary[]> => {
  await ensureProductTable();
  const db = getDb();

  const [rows] = await db.query<
    (ProductRow & {
      category_name: string;
      owner_name: string;
      owner_email: string;
    })[]
  >(
    `
      SELECT p.*, c.name AS category_name, u.name AS owner_name, u.email AS owner_email
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      INNER JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
    `,
  );

  return rows.map((row) => mapProductRow(row) as AdminProductSummary);
};

export const getCategoryOwner = async (categoryId: number) => {
  await ensureCategoryTable();
  const db = getDb();
  const [rows] = await db.query<CategoryRow[]>(
    "SELECT * FROM categories WHERE id = ? LIMIT 1",
    [categoryId],
  );

  return rows[0] ?? null;
};

export const insertCategory = async (
  payload: {
    userId: number;
    name: string;
    price: number;
    sku: string;
    description: string;
    imagePath: string | null;
    isActive: boolean;
  },
) => {
  await ensureCategoryTable();
  const db = getDb();
  const [result] = await db.query<ResultSetHeader>(
    `
      INSERT INTO categories (user_id, name, price, sku, description, image_path, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.userId,
      payload.name,
      payload.price.toFixed(2),
      payload.sku,
      payload.description,
      payload.imagePath,
      payload.isActive ? 1 : 0,
    ],
  );

  return result.insertId;
};

export const updateCategory = async (
  categoryId: number,
  payload: {
    name: string;
    price: number;
    sku: string;
    description: string;
    imagePath: string | null;
    isActive: boolean;
  },
) => {
  await ensureCategoryTable();
  const db = getDb();
  await db.query(
    `
      UPDATE categories
      SET name = ?, price = ?, sku = ?, description = ?, image_path = ?, is_active = ?
      WHERE id = ?
    `,
    [
      payload.name,
      payload.price.toFixed(2),
      payload.sku,
      payload.description,
      payload.imagePath,
      payload.isActive ? 1 : 0,
      categoryId,
    ],
  );
};

export const deleteCategory = async (categoryId: number) => {
  await ensureCategoryTable();
  const db = getDb();
  await db.query("DELETE FROM categories WHERE id = ?", [categoryId]);
};

export const getProductOwner = async (productId: number) => {
  await ensureProductTable();
  const db = getDb();
  const [rows] = await db.query<ProductRow[]>(
    "SELECT * FROM products WHERE id = ? LIMIT 1",
    [productId],
  );

  return rows[0] ?? null;
};

export const insertProduct = async (
  payload: {
    userId: number;
    categoryId: number;
    categoryName: string;
    details: string;
    filePath: string | null;
    resaleLimit: number;
  },
) => {
  await ensureProductTable();
  const db = getDb();
  const [result] = await db.query<ResultSetHeader>(
    `
      INSERT INTO products (user_id, category_id, name, details, file_path, resale_limit)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      payload.userId,
      payload.categoryId,
      payload.categoryName,
      payload.details,
      payload.filePath,
      payload.resaleLimit,
    ],
  );

  return result.insertId;
};

export const updateProduct = async (
  productId: number,
  payload: {
    categoryId: number;
    categoryName: string;
    details: string;
    filePath: string | null;
    resaleLimit: number;
  },
) => {
  await ensureProductTable();
  const db = getDb();
  await db.query(
    `
      UPDATE products
      SET category_id = ?, name = ?, details = ?, file_path = ?, resale_limit = ?
      WHERE id = ?
    `,
    [
      payload.categoryId,
      payload.categoryName,
      payload.details,
      payload.filePath,
      payload.resaleLimit,
      productId,
    ],
  );
};

export const deleteProduct = async (productId: number) => {
  await ensureProductTable();
  const db = getDb();
  await db.query("DELETE FROM products WHERE id = ?", [productId]);
};

export const decrementProductResaleLimit = async (productId: number): Promise<boolean> => {
  await ensureProductTable();
  const db = getDb();

  const [result] = await db.query<ResultSetHeader>(
    `
      UPDATE products
      SET resale_limit = resale_limit - 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND resale_limit > 0
    `,
    [productId],
  );

  return result.affectedRows > 0;
};

export const restoreProductResaleLimit = async (productId: number) => {
  await ensureProductTable();
  const db = getDb();

  await db.query(
    `
      UPDATE products
      SET resale_limit = resale_limit + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [productId],
  );
};
