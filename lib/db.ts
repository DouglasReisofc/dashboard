import mysql, { Pool } from "mysql2/promise";

const DATABASE_HOST = process.env.DATABASE_HOST ?? "localhost";
const DATABASE_PORT = Number(process.env.DATABASE_PORT ?? 3306);
const DATABASE_USER = process.env.DATABASE_USER ?? "root";
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? "";
const DATABASE_NAME = process.env.DATABASE_NAME ?? "dashboard";

let pool: Pool | null = null;

export const getDb = (): Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: DATABASE_HOST,
      port: DATABASE_PORT,
      user: DATABASE_USER,
      password: DATABASE_PASSWORD,
      database: DATABASE_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: "Z",
    });
  }

  return pool;
};

export const ensureUserTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
};

export type UserRow = {
  id: number;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  created_at: Date;
  updated_at: Date;
};

export const ensureCategoryTable = async () => {
  const db = getDb();
  await ensureUserTable();
  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      sku VARCHAR(100) NOT NULL,
      description TEXT,
      image_path VARCHAR(255),
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT unique_category_sku_per_user UNIQUE KEY unique_category_sku_per_user (user_id, sku)
    ) ENGINE=InnoDB;
  `);
};

export const ensureProductTable = async () => {
  const db = getDb();
  await ensureCategoryTable();
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      category_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      details TEXT NOT NULL,
      file_path VARCHAR(255),
      resale_limit INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
};

export type CategoryRow = {
  id: number;
  user_id: number;
  name: string;
  price: string;
  sku: string;
  description: string | null;
  image_path: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

export type ProductRow = {
  id: number;
  user_id: number;
  category_id: number;
  name: string;
  details: string;
  file_path: string | null;
  resale_limit: number;
  created_at: Date;
  updated_at: Date;
};
