import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";

const DATABASE_HOST = process.env.DATABASE_HOST ?? "localhost";
const DATABASE_PORT = Number(process.env.DATABASE_PORT ?? 3306);
const DATABASE_USER = process.env.DATABASE_USER ?? "root";
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? "";
const DATABASE_NAME = process.env.DATABASE_NAME ?? "dashboard";
const DEFAULT_ADMIN_EMAIL =
  process.env.DEFAULT_ADMIN_EMAIL ?? "contactgestorvip@gmail.com";
const DEFAULT_ADMIN_PASSWORD =
  process.env.DEFAULT_ADMIN_PASSWORD ?? "Dev7766@#$%";
const DEFAULT_ADMIN_NAME =
  process.env.DEFAULT_ADMIN_NAME ?? "Administrador StoreBot";

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
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
      whatsapp_number VARCHAR(32) NULL,
      avatar_path VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  const [isActiveColumn] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM users LIKE 'is_active'",
  );

  if (!Array.isArray(isActiveColumn) || isActiveColumn.length === 0) {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
        AFTER role;
    `);
  }

  const [balanceColumn] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM users LIKE 'balance'",
  );

  if (!Array.isArray(balanceColumn) || balanceColumn.length === 0) {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN balance DECIMAL(12, 2) NOT NULL DEFAULT 0
        AFTER is_active;
    `);
  }

  const [whatsappColumn] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM users LIKE 'whatsapp_number'",
  );

  if (!Array.isArray(whatsappColumn) || whatsappColumn.length === 0) {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN whatsapp_number VARCHAR(32) NULL
        AFTER balance;
    `);
  }

  const [avatarColumn] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM users LIKE 'avatar_path'",
  );

  if (!Array.isArray(avatarColumn) || avatarColumn.length === 0) {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN avatar_path VARCHAR(255) NULL
        AFTER whatsapp_number;
    `);
  }

  await ensureWebhookTable();
  await ensureWebhookEventTable();
  await ensureCustomerTable();
  await ensurePaymentMethodTable();
  await ensurePaymentChargeTable();
  await ensureSiteSettingsTable();
  await ensureUserPlanSubscriptionTable();
  await ensureUserPlanPaymentTable();
  await ensureUserBalancePaymentTable();
  await ensureUserPurchaseHistoryTable();
  await ensureFieldTutorialTable();

  const normalizedEmail = DEFAULT_ADMIN_EMAIL.toLowerCase().trim();
  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

  await db.query(
    `
      INSERT INTO users (name, email, password, role, is_active, balance)
      VALUES (?, ?, ?, 'admin', 1, 0)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        password = VALUES(password),
        role = 'admin',
        is_active = 1
    `,
    [DEFAULT_ADMIN_NAME.trim(), normalizedEmail, hashedPassword],
  );

  const [adminRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [normalizedEmail],
  );

  if (Array.isArray(adminRows) && adminRows.length > 0) {
    const adminId = Number(adminRows[0].id);

    const [webhookRows] = await db.query<RowDataPacket[]>(
      "SELECT id FROM user_webhooks WHERE user_id = ? LIMIT 1",
      [adminId],
    );

    if (!Array.isArray(webhookRows) || webhookRows.length === 0) {
      await db.query(
        `
          INSERT INTO user_webhooks (id, user_id, verify_token)
          VALUES (?, ?, ?)
        `,
        [randomUUID(), adminId, randomBytes(24).toString("hex")],
      );
    }
  }
};

export type UserRow = {
  id: number;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  is_active: number;
  balance: string;
  whatsapp_number: string | null;
  avatar_path: string | null;
  created_at: Date;
  updated_at: Date;
};

export const ensureSessionTable = async () => {
  const db = getDb();
  await ensureUserTable();
  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id CHAR(36) PRIMARY KEY,
      user_id INT NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_sessions_user (user_id),
      INDEX idx_sessions_active (user_id, expires_at, revoked_at)
    ) ENGINE=InnoDB;
  `);
};

export type SessionRow = {
  id: string;
  user_id: number;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
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

export const ensureBotMenuConfigTable = async () => {
  const db = getDb();
  await ensureUserTable();
  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_menu_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      menu_text TEXT NOT NULL,
      variables TEXT NULL,
      image_path VARCHAR(255) NULL,
      menu_footer_text TEXT NULL,
      menu_button_buy VARCHAR(120) NULL,
      menu_button_add_balance VARCHAR(120) NULL,
      menu_button_support VARCHAR(120) NULL,
      category_list_header TEXT NULL,
      category_list_body TEXT NULL,
      category_list_footer TEXT NULL,
      category_list_footer_more TEXT NULL,
      category_list_button VARCHAR(120) NULL,
      category_list_section VARCHAR(255) NULL,
      category_list_next_title VARCHAR(120) NULL,
      category_list_next_description VARCHAR(255) NULL,
      category_list_empty TEXT NULL,
      category_detail_body TEXT NULL,
      category_detail_footer TEXT NULL,
      category_detail_button VARCHAR(120) NULL,
      category_detail_caption VARCHAR(255) NULL,
      menu_add_balance_reply TEXT NULL,
      menu_support_reply TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_bot_menu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  const addColumnIfMissing = async (column: string, definition: string) => {
    const [existing] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM bot_menu_configs LIKE ?",
      [column],
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      await db.query(`ALTER TABLE bot_menu_configs ADD COLUMN ${column} ${definition}`);
    }
  };

  await addColumnIfMissing("menu_footer_text", "TEXT NULL");
  await addColumnIfMissing("menu_button_buy", "VARCHAR(120) NULL");
  await addColumnIfMissing("menu_button_add_balance", "VARCHAR(120) NULL");
  await addColumnIfMissing("menu_button_support", "VARCHAR(120) NULL");
  await addColumnIfMissing("category_list_header", "TEXT NULL");
  await addColumnIfMissing("category_list_body", "TEXT NULL");
  await addColumnIfMissing("category_list_footer", "TEXT NULL");
  await addColumnIfMissing("category_list_footer_more", "TEXT NULL");
  await addColumnIfMissing("category_list_button", "VARCHAR(120) NULL");
  await addColumnIfMissing("category_list_section", "VARCHAR(255) NULL");
  await addColumnIfMissing("category_list_next_title", "VARCHAR(120) NULL");
  await addColumnIfMissing("category_list_next_description", "VARCHAR(255) NULL");
  await addColumnIfMissing("category_list_empty", "TEXT NULL");
  await addColumnIfMissing("category_detail_body", "TEXT NULL");
  await addColumnIfMissing("category_detail_footer", "TEXT NULL");
  await addColumnIfMissing("category_detail_button", "VARCHAR(120) NULL");
  await addColumnIfMissing("category_detail_caption", "VARCHAR(255) NULL");
  await addColumnIfMissing("menu_add_balance_reply", "TEXT NULL");
  await addColumnIfMissing("menu_support_reply", "TEXT NULL");
};

export const ensureCustomerTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      whatsapp_id VARCHAR(32) NOT NULL,
      phone_number VARCHAR(32) NOT NULL,
      display_name VARCHAR(255) NULL,
      profile_name VARCHAR(255) NULL,
      notes TEXT NULL,
      balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
      is_blocked TINYINT(1) NOT NULL DEFAULT 0,
      last_interaction DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT unique_customer_user_whatsapp UNIQUE KEY unique_customer_user_whatsapp (user_id, whatsapp_id)
    ) ENGINE=InnoDB;
  `);
};

export const ensurePaymentMethodTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_payment_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      provider VARCHAR(64) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 0,
      display_name VARCHAR(255) NULL,
      credentials LONGTEXT NULL,
      settings LONGTEXT NULL,
      metadata LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_payment_methods_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT unique_payment_method UNIQUE KEY unique_payment_method (user_id, provider)
    ) ENGINE=InnoDB;
  `);
};

export const ensureAdminPaymentMethodTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_payment_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      provider VARCHAR(64) NOT NULL UNIQUE,
      is_active TINYINT(1) NOT NULL DEFAULT 0,
      display_name VARCHAR(255) NULL,
      credentials LONGTEXT NULL,
      settings LONGTEXT NULL,
      metadata LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
};

export const ensurePaymentChargeTable = async () => {
  const db = getDb();
  await ensurePaymentMethodTable();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_payment_charges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      public_id CHAR(36) NOT NULL UNIQUE,
      user_id INT NOT NULL,
      provider VARCHAR(64) NOT NULL,
      provider_payment_id VARCHAR(128) NOT NULL,
      status VARCHAR(64) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
      qr_code LONGTEXT NULL,
      qr_code_base64 LONGTEXT NULL,
      ticket_url TEXT NULL,
      expires_at DATETIME NULL,
      customer_whatsapp VARCHAR(32) NULL,
      customer_name VARCHAR(255) NULL,
      metadata LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_payment_charges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT unique_provider_payment UNIQUE KEY unique_provider_payment (provider, provider_payment_id)
    ) ENGINE=InnoDB;
  `);
};

export const ensureSubscriptionPlanTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      description TEXT NULL,
      price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      category_limit INT NOT NULL DEFAULT 0,
      duration_days INT NOT NULL DEFAULT 30,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
};

export const ensureSiteSettingsTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_site_settings (
      user_id INT PRIMARY KEY,
      site_name VARCHAR(120) NOT NULL,
      tagline VARCHAR(255) NULL,
      logo_path VARCHAR(255) NULL,
      favicon_path VARCHAR(255) NULL,
      seo_image_path VARCHAR(255) NULL,
      seo_title VARCHAR(160) NULL,
      seo_description VARCHAR(320) NULL,
      seo_keywords VARCHAR(512) NULL,
      footer_text TEXT NULL,
      footer_links LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_site_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  const ensureColumn = async (column: string, definition: string) => {
    const [existing] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM user_site_settings LIKE ?",
      [column],
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      await db.query(`ALTER TABLE user_site_settings ADD COLUMN ${definition};`);
    }
  };

  await Promise.all([
    ensureColumn("logo_path", "logo_path VARCHAR(255) NULL"),
    ensureColumn("favicon_path", "favicon_path VARCHAR(255) NULL"),
    ensureColumn("seo_image_path", "seo_image_path VARCHAR(255) NULL"),
  ]);
};

export const ensureAdminSiteSettingsTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_site_settings (
      id TINYINT PRIMARY KEY,
      site_name VARCHAR(120) NOT NULL,
      tagline VARCHAR(255) NULL,
      logo_path VARCHAR(255) NULL,
      support_email VARCHAR(160) NULL,
      support_phone VARCHAR(40) NULL,
      hero_title VARCHAR(160) NULL,
      hero_subtitle VARCHAR(255) NULL,
      hero_button_label VARCHAR(60) NULL,
      hero_button_url VARCHAR(300) NULL,
      seo_title VARCHAR(160) NULL,
      seo_description VARCHAR(320) NULL,
      seo_image_path VARCHAR(255) NULL,
      footer_text TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  const ensureColumn = async (column: string, definition: string) => {
    const [existing] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM admin_site_settings LIKE ?",
      [column],
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      await db.query(`ALTER TABLE admin_site_settings ADD COLUMN ${definition};`);
    }
  };

  await Promise.all([
    ensureColumn("logo_path", "logo_path VARCHAR(255) NULL"),
    ensureColumn("seo_image_path", "seo_image_path VARCHAR(255) NULL"),
  ]);

  await db.query(
    `INSERT INTO admin_site_settings (id, site_name)
     VALUES (1, 'StoreBot')
     ON DUPLICATE KEY UPDATE site_name = site_name`);
};

export const ensureAdminSmtpSettingsTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_smtp_settings (
      id TINYINT PRIMARY KEY,
      host VARCHAR(255) NOT NULL,
      port INT NOT NULL DEFAULT 587,
      is_secure TINYINT(1) NOT NULL DEFAULT 0,
      username VARCHAR(255) NULL,
      password VARCHAR(255) NULL,
      from_name VARCHAR(255) NOT NULL,
      from_email VARCHAR(255) NOT NULL,
      reply_to VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await db.query(
    `
      INSERT INTO admin_smtp_settings (
        id,
        host,
        port,
        is_secure,
        username,
        password,
        from_name,
        from_email
      ) VALUES (1, 'smtp.exemplo.com', 587, 0, NULL, NULL, 'StoreBot', 'no-reply@storebot.app')
      ON DUPLICATE KEY UPDATE id = id
    `,
  );
};

export const ensureAdminBotConfigTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_bot_config (
      id TINYINT PRIMARY KEY,
      menu_text TEXT NOT NULL,
      menu_footer_text VARCHAR(255) NULL,
      panel_button_text VARCHAR(60) NOT NULL,
      subscription_button_text VARCHAR(60) NOT NULL,
      support_button_text VARCHAR(60) NOT NULL,
      menu_image_path VARCHAR(255) NULL,
      subscription_header_text VARCHAR(160) NOT NULL,
      subscription_body_text TEXT NOT NULL,
      subscription_footer_text VARCHAR(255) NULL,
      subscription_renew_button_text VARCHAR(60) NOT NULL,
      subscription_change_button_text VARCHAR(60) NOT NULL,
      subscription_details_button_text VARCHAR(60) NOT NULL,
      subscription_no_plan_header_text VARCHAR(160) NOT NULL,
      subscription_no_plan_body_text TEXT NOT NULL,
      subscription_no_plan_button_text VARCHAR(60) NOT NULL,
      subscription_plan_list_title VARCHAR(60) NOT NULL,
      subscription_plan_list_body TEXT NOT NULL,
      subscription_plan_list_button_text VARCHAR(60) NOT NULL,
      subscription_plan_list_footer_text VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await db.query(
    `
      INSERT INTO admin_bot_config (
        id,
        menu_text,
        menu_footer_text,
        panel_button_text,
        subscription_button_text,
        support_button_text,
        menu_image_path,
        subscription_header_text,
        subscription_body_text,
        subscription_footer_text,
        subscription_renew_button_text,
        subscription_change_button_text,
        subscription_details_button_text,
        subscription_no_plan_header_text,
        subscription_no_plan_body_text,
        subscription_no_plan_button_text,
        subscription_plan_list_title,
        subscription_plan_list_body,
        subscription_plan_list_button_text,
        subscription_plan_list_footer_text
      ) VALUES (
        1,
        'Olá {{user_first_name}},\n\nBem-vindo ao painel rápido do StoreBot pelo WhatsApp. Use os botões abaixo para navegar pelas funções principais.',
        'Selecione uma opção para continuar.',
        'Painel',
        'Assinatura',
        'Suporte',
        NULL,
        'Resumo do plano',
        'Plano: {{plan_name}}\nStatus: {{plan_status}}\nValor: {{plan_price}}\nVencimento: {{plan_renews_at}}',
        'Escolha uma ação para gerenciar sua assinatura.',
        'Renovar',
        'Mudar plano',
        'Ver detalhes',
        'Você ainda não possui um plano ativo.',
        'Escolha a melhor opção para iniciar sua assinatura do StoreBot e liberar todos os recursos.',
        'Assinar plano',
        'Planos disponíveis',
        'Selecione um dos planos abaixo para gerar o pagamento imediatamente.',
        'Escolher',
        'Após selecionar um plano enviaremos o link de pagamento automaticamente.'
      )
      ON DUPLICATE KEY UPDATE id = id
    `,
  );
};

export const ensureAdminEmailTemplatesTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_email_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_key VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      heading VARCHAR(255) NOT NULL,
      body_html LONGTEXT NOT NULL,
      cta_label VARCHAR(120) NULL,
      cta_url VARCHAR(255) NULL,
      footer_text VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  const defaults: Array<[
    string,
    string,
    string,
    string,
    string,
    string | null,
    string | null,
    string | null
  ]> = [
    [
      "plan_payment_confirmation",
      "Confirmação de pagamento do plano",
      "Pagamento confirmado - {{planName}}",
      "Acesso liberado!",
      "<p>Olá, <strong>{{userName}}</strong>! Recebemos a confirmação do pagamento do plano <strong>{{planName}}</strong> no valor de <strong>{{amount}}</strong>.</p><p>Seu acesso ao StoreBot foi liberado imediatamente. Comece agora mesmo a configurar suas automações e aproveite os recursos exclusivos do plano selecionado.</p>",
      "Ir para o painel",
      "{{dashboardUrl}}",
      "Precisa de ajuda? Responda este e-mail e nossa equipe entrará em contato."
    ],
    [
      "user_registration",
      "Boas-vindas ao StoreBot",
      "Conta criada com sucesso",
      "Seja bem-vindo(a)!",
      "<p>Olá, <strong>{{userName}}</strong>! Sua conta foi criada e você já pode acessar o StoreBot para construir experiências incríveis para seus clientes.</p><p>Acesse o painel para configurar seu bot, cadastrar produtos e ativar os canais de atendimento.</p>",
      "Acessar o painel",
      "{{dashboardUrl}}",
      "Estamos por aqui para o que precisar."
    ],
    [
      "bot_sale_notification",
      "Nova venda no seu bot",
      "Você recebeu uma nova venda",
      "Venda aprovada!",
      "<p>Olá, <strong>{{userName}}</strong>! Uma nova venda foi confirmada no seu bot pelo valor de <strong>{{amount}}</strong>.</p><p>Forma de pagamento: <strong>{{paymentMethod}}</strong>.</p><p>Cliente: {{customer}}</p>",
      "Ver detalhes",
      "{{salesUrl}}",
      "Continue oferecendo a melhor experiência para os seus clientes."
    ],
    [
      "generic_notification",
      "Notificação StoreBot",
      "{{subject}}",
      "Olá!",
      "<p>Esta é uma mensagem automática do StoreBot.</p><p>{{message}}</p>",
      null,
      null,
      "Equipe StoreBot"
    ],
  ];

  await Promise.all(
    defaults.map(async (entry) => {
      await db.query(
        `
          INSERT INTO admin_email_templates (
            template_key,
            name,
            subject,
            heading,
            body_html,
            cta_label,
            cta_url,
            footer_text
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE template_key = template_key
        `,
        entry,
      );
    }),
  );
};

export const ensureUserPlanSubscriptionTable = async () => {
  const db = getDb();
  await ensureSubscriptionPlanTable();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_plan_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      plan_id INT NOT NULL,
      status ENUM('pending','active','expired','cancelled') NOT NULL DEFAULT 'pending',
      current_period_start DATETIME NULL,
      current_period_end DATETIME NULL,
      cancelled_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_plan_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_plan_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    ) ENGINE=InnoDB;
  `);
};

export const ensureUserPlanPaymentTable = async () => {
  const db = getDb();
  await ensureSubscriptionPlanTable();
  await ensureUserPlanSubscriptionTable();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_plan_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      plan_id INT NOT NULL,
      subscription_id INT NULL,
      provider VARCHAR(64) NOT NULL,
      provider_payment_id VARCHAR(128) NOT NULL,
      status VARCHAR(64) NOT NULL,
      status_detail VARCHAR(64) NULL,
      amount DECIMAL(12, 2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
      metadata LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_plan_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_plan_payments_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
      CONSTRAINT fk_user_plan_payments_subscription FOREIGN KEY (subscription_id) REFERENCES user_plan_subscriptions(id) ON DELETE SET NULL,
      CONSTRAINT unique_user_plan_payment UNIQUE KEY unique_user_plan_payment (provider, provider_payment_id)
    ) ENGINE=InnoDB;
  `);
};

export const ensureUserBalancePaymentTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_balance_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      provider VARCHAR(64) NOT NULL,
      provider_payment_id VARCHAR(128) NOT NULL,
      status VARCHAR(64) NOT NULL,
      status_detail VARCHAR(64) NULL,
      amount DECIMAL(12, 2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
      metadata LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_balance_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT unique_user_balance_payment UNIQUE KEY unique_user_balance_payment (provider, provider_payment_id)
    ) ENGINE=InnoDB;
  `);
};

export const ensureUserPurchaseHistoryTable = async () => {
  const db = getDb();
  await ensureCustomerTable();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_purchase_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      customer_id INT NULL,
      customer_whatsapp VARCHAR(32) NULL,
      customer_name VARCHAR(255) NULL,
      category_id INT NULL,
      category_name VARCHAR(255) NOT NULL,
      category_price DECIMAL(12, 2) NOT NULL,
      category_description TEXT NULL,
      product_id INT NULL,
      product_details TEXT NOT NULL,
      product_file_path VARCHAR(255) NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
      metadata LONGTEXT NULL,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_purchase_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_purchase_history_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      INDEX idx_purchase_history_user (user_id, purchased_at),
      INDEX idx_purchase_history_customer (customer_id)
    ) ENGINE=InnoDB;
  `);
};

export const ensureFieldTutorialTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS field_tutorials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(80) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      media_path VARCHAR(255) NULL,
      media_type ENUM('image', 'video') NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
};

export const ensureWebhookTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_webhooks (
      id CHAR(36) PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      verify_token VARCHAR(128) NOT NULL,
      app_id VARCHAR(64) NULL,
      app_secret VARCHAR(128) NULL,
      business_account_id VARCHAR(64) NULL,
      phone_number_id VARCHAR(64) NULL,
      phone_number VARCHAR(32) NULL,
      access_token TEXT NULL,
      last_event_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_webhooks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  const dropLegacyColumn = async (column: string) => {
    const [existing] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM user_webhooks LIKE ?",
      [column],
    );

    if (Array.isArray(existing) && existing.length > 0) {
      await db.query(`ALTER TABLE user_webhooks DROP COLUMN ${column};`);
    }
  };

  await dropLegacyColumn("api_key");

  const ensureColumn = async (column: string, definition: string) => {
    const [existing] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM user_webhooks LIKE ?",
      [column],
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      await db.query(`ALTER TABLE user_webhooks ADD COLUMN ${definition};`);
    }
  };

  await ensureColumn("app_id", "app_id VARCHAR(64) NULL");
  await ensureColumn("app_secret", "app_secret VARCHAR(128) NULL");
  await ensureColumn(
    "business_account_id",
    "business_account_id VARCHAR(64) NULL",
  );
  await ensureColumn("phone_number_id", "phone_number_id VARCHAR(64) NULL");
  await ensureColumn("phone_number", "phone_number VARCHAR(32) NULL");
  await ensureColumn("access_token", "access_token TEXT NULL");
};

export const ensureUserNotificationTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      metadata LONGTEXT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      read_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_notifications_user (user_id, is_read, created_at)
    ) ENGINE=InnoDB;
  `);
};

export const ensureWebhookEventTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_webhook_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      webhook_id CHAR(36) NOT NULL,
      user_id INT NOT NULL,
      event_type VARCHAR(191) NULL,
      payload LONGTEXT NOT NULL,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_webhook_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_webhook_events_webhook FOREIGN KEY (webhook_id) REFERENCES user_webhooks(id) ON DELETE CASCADE,
      INDEX idx_webhook_events_user (user_id),
      INDEX idx_webhook_events_webhook (webhook_id, received_at)
    ) ENGINE=InnoDB;
  `);
};

export const ensureAdminWebhookTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_webhooks (
      id CHAR(36) PRIMARY KEY,
      verify_token VARCHAR(128) NOT NULL,
      app_id VARCHAR(64) NULL,
      business_account_id VARCHAR(64) NULL,
      phone_number_id VARCHAR(64) NULL,
      phone_number VARCHAR(32) NULL,
      access_token TEXT NULL,
      last_event_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  const ensureColumn = async (column: string, definition: string) => {
    const [existing] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM admin_webhooks LIKE ?",
      [column],
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      await db.query(`ALTER TABLE admin_webhooks ADD COLUMN ${definition};`);
    }
  };

  await Promise.all([
    ensureColumn("app_id", "app_id VARCHAR(64) NULL"),
    ensureColumn("business_account_id", "business_account_id VARCHAR(64) NULL"),
    ensureColumn("phone_number_id", "phone_number_id VARCHAR(64) NULL"),
    ensureColumn("phone_number", "phone_number VARCHAR(32) NULL"),
    ensureColumn("access_token", "access_token TEXT NULL"),
    ensureColumn("last_event_at", "last_event_at DATETIME NULL"),
  ]);
};

export const ensureAdminWebhookEventTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_webhook_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      webhook_id CHAR(36) NOT NULL,
      event_type VARCHAR(191) NULL,
      payload LONGTEXT NOT NULL,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_webhook_events (webhook_id, received_at)
    ) ENGINE=InnoDB;
  `);
};

export const ensureAdminBotSessionTable = async () => {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_bot_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      whatsapp_id VARCHAR(32) NOT NULL UNIQUE,
      whatsapp_e164 VARCHAR(32) NOT NULL,
      user_id INT NOT NULL,
      flow_state VARCHAR(64) NULL,
      flow_context LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_interaction_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_admin_bot_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  const ensureColumn = async (column: string, definition: string) => {
    const [existing] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM admin_bot_sessions LIKE ?",
      [column],
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      await db.query(`ALTER TABLE admin_bot_sessions ADD COLUMN ${definition};`);
    }
  };

  await Promise.all([
    ensureColumn("flow_state", "flow_state VARCHAR(64) NULL"),
    ensureColumn("flow_context", "flow_context LONGTEXT NULL"),
  ]);
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

export type CustomerRow = {
  id: number;
  user_id: number;
  whatsapp_id: string;
  phone_number: string;
  display_name: string | null;
  profile_name: string | null;
  notes: string | null;
  balance: string;
  is_blocked: number;
  last_interaction: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UserPaymentMethodRow = {
  id: number;
  user_id: number;
  provider: string;
  is_active: number;
  display_name: string | null;
  credentials: string | null;
  settings: string | null;
  metadata: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AdminPaymentMethodRow = {
  id: number;
  provider: string;
  is_active: number;
  display_name: string | null;
  credentials: string | null;
  settings: string | null;
  metadata: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SubscriptionPlanRow = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  category_limit: number;
  duration_days: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

export type UserPaymentChargeRow = {
  id: number;
  public_id: string;
  user_id: number;
  provider: string;
  provider_payment_id: string;
  status: string;
  amount: string;
  currency: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expires_at: Date | null;
  customer_whatsapp: string | null;
  customer_name: string | null;
  metadata: string | null;
  created_at: Date;
  updated_at: Date;
};

export type UserPurchaseHistoryRow = {
  id: number;
  user_id: number;
  customer_id: number | null;
  customer_whatsapp: string | null;
  customer_name: string | null;
  category_id: number | null;
  category_name: string;
  category_price: string;
  category_description: string | null;
  product_id: number | null;
  product_details: string;
  product_file_path: string | null;
  currency: string;
  metadata: string | null;
  purchased_at: Date;
  created_at: Date;
};

export type FieldTutorialRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  created_at: Date;
  updated_at: Date;
};

export type UserSiteSettingsRow = {
  user_id: number;
  site_name: string;
  tagline: string | null;
  logo_path: string | null;
  favicon_path: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_image_path: string | null;
  seo_keywords: string | null;
  footer_text: string | null;
  footer_links: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AdminSiteSettingsRow = {
  id: number;
  site_name: string;
  tagline: string | null;
  logo_path: string | null;
  support_email: string | null;
  support_phone: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_button_label: string | null;
  hero_button_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_image_path: string | null;
  footer_text: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AdminBotConfigRow = {
  id: number;
  menu_text: string;
  menu_footer_text: string | null;
  panel_button_text: string;
  subscription_button_text: string;
  support_button_text: string;
  menu_image_path: string | null;
  subscription_header_text: string;
  subscription_body_text: string;
  subscription_footer_text: string | null;
  subscription_renew_button_text: string;
  subscription_change_button_text: string;
  subscription_details_button_text: string;
  subscription_no_plan_header_text: string;
  subscription_no_plan_body_text: string;
  subscription_no_plan_button_text: string;
  subscription_plan_list_title: string;
  subscription_plan_list_body: string;
  subscription_plan_list_button_text: string;
  subscription_plan_list_footer_text: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AdminWebhookRow = {
  id: string;
  verify_token: string;
  app_id: string | null;
  business_account_id: string | null;
  phone_number_id: string | null;
  phone_number: string | null;
  access_token: string | null;
  last_event_at: Date | string | null;
  created_at: Date;
  updated_at: Date;
};

export type AdminWebhookEventRow = {
  id: number;
  webhook_id: string;
  event_type: string | null;
  payload: string;
  received_at: Date;
};

export type AdminBotSessionRow = {
  id: number;
  whatsapp_id: string;
  whatsapp_e164: string;
  user_id: number;
  flow_state: string | null;
  flow_context: string | null;
  created_at: Date;
  last_interaction_at: Date;
};

export type AdminSmtpSettingsRow = {
  id: number;
  host: string;
  port: number;
  is_secure: number;
  username: string | null;
  password: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AdminEmailTemplateRow = {
  id: number;
  template_key: string;
  name: string;
  subject: string;
  heading: string;
  body_html: string;
  cta_label: string | null;
  cta_url: string | null;
  footer_text: string | null;
  created_at: Date;
  updated_at: Date;
};

export type UserPlanSubscriptionRow = {
  id: number;
  user_id: number;
  plan_id: number;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UserPlanPaymentRow = {
  id: number;
  user_id: number;
  plan_id: number;
  subscription_id: number | null;
  provider: string;
  provider_payment_id: string;
  status: string;
  status_detail: string | null;
  amount: string;
  currency: string;
  metadata: string | null;
  created_at: Date;
  updated_at: Date;
};

export type UserBalancePaymentRow = {
  id: number;
  user_id: number;
  provider: string;
  provider_payment_id: string;
  status: string;
  status_detail: string | null;
  amount: string;
  currency: string;
  metadata: string | null;
  created_at: Date;
  updated_at: Date;
};

export type UserNotificationRow = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  metadata: string | null;
  is_read: number;
  read_at: Date | null;
  created_at: Date;
};

export type BotMenuConfigRow = {
  id: number;
  user_id: number;
  menu_text: string;
  variables: string | null;
  image_path: string | null;
  menu_footer_text: string | null;
  menu_button_buy: string | null;
  menu_button_add_balance: string | null;
  menu_button_support: string | null;
  category_list_header: string | null;
  category_list_body: string | null;
  category_list_footer: string | null;
  category_list_footer_more: string | null;
  category_list_button: string | null;
  category_list_section: string | null;
  category_list_next_title: string | null;
  category_list_next_description: string | null;
  category_list_empty: string | null;
  category_detail_body: string | null;
  category_detail_footer: string | null;
  category_detail_button: string | null;
  category_detail_caption: string | null;
  menu_add_balance_reply: string | null;
  menu_support_reply: string | null;
  created_at: Date;
  updated_at: Date;
};

export type UserWebhookRow = {
  id: string;
  user_id: number;
  verify_token: string;
  app_id: string | null;
  app_secret: string | null;
  business_account_id: string | null;
  phone_number_id: string | null;
  phone_number: string | null;
  access_token: string | null;
  last_event_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type WebhookEventRow = {
  id: number;
  webhook_id: string;
  user_id: number;
  event_type: string | null;
  payload: string;
  received_at: Date;
};
