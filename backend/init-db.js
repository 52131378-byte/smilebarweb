const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

async function main() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "smilebardb";
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  await conn.query(schemaSql);

  // Ensure we are using the app database for any follow-up migrations/seeding
  await conn.query(`USE \`${database}\`;`);

  // Lightweight migration: add feedback columns if the table already existed
  // (ignore "duplicate column" errors so this stays idempotent)
  const alterStatements = [
    "ALTER TABLE `feedback` ADD COLUMN `fname` VARCHAR(255) NULL",
    "ALTER TABLE `feedback` ADD COLUMN `lname` VARCHAR(255) NULL",
    "ALTER TABLE `items` ADD COLUMN `stock_quantity` INT NOT NULL DEFAULT 1000000",
    "ALTER TABLE `admin_users` ADD COLUMN `username` VARCHAR(255) NULL",
    "ALTER TABLE `admin_users` ADD UNIQUE KEY `uniq_admin_username` (`username`)",
  ];
  for (const sql of alterStatements) {
    try {
      await conn.query(sql);
    } catch (e) {
      const code = e?.code;
      if (code !== "ER_DUP_FIELDNAME") throw e;
    }
  }

  // Ensure clients table exists for older DBs (safe if it already exists)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`clients\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(255) NULL,
      \`email\` VARCHAR(320) NOT NULL,
      \`password_hash\` VARCHAR(255) NOT NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uniq_client_email\` (\`email\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Orders tables (safe if they already exist)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`orders\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`client_id\` INT NOT NULL,
      \`full_name\` VARCHAR(255) NOT NULL,
      \`phone\` VARCHAR(50) NOT NULL,
      \`address\` VARCHAR(500) NOT NULL,
      \`city\` VARCHAR(255) NOT NULL,
      \`notes\` TEXT NULL,
      \`payment_method\` VARCHAR(50) NOT NULL DEFAULT 'cash_on_delivery',
      \`status\` VARCHAR(50) NOT NULL DEFAULT 'pending',
      \`subtotal\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`shipping\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`total\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_orders_client_id\` (\`client_id\`),
      KEY \`idx_orders_created_at\` (\`created_at\`),
      CONSTRAINT \`fk_orders_client\`
        FOREIGN KEY (\`client_id\`) REFERENCES \`clients\`(\`id\`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`order_items\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`order_id\` INT NOT NULL,
      \`item_id\` INT NOT NULL,
      \`name\` VARCHAR(255) NOT NULL,
      \`unit_price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`quantity\` INT NOT NULL DEFAULT 1,
      \`line_total\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      PRIMARY KEY (\`id\`),
      KEY \`idx_order_items_order_id\` (\`order_id\`),
      KEY \`idx_order_items_item_id\` (\`item_id\`),
      CONSTRAINT \`fk_order_items_order\`
        FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT \`fk_order_items_item\`
        FOREIGN KEY (\`item_id\`) REFERENCES \`items\`(\`id\`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Token revocation list (for logout)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`revoked_tokens\` (
      \`id\` BIGINT NOT NULL AUTO_INCREMENT,
      \`jti\` VARCHAR(64) NOT NULL,
      \`expires_at\` TIMESTAMP NULL,
      \`revoked_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uniq_revoked_jti\` (\`jti\`),
      KEY \`idx_revoked_expires_at\` (\`expires_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Optional: seed an admin user (recommended for first-time setup)
  if (adminEmail && adminPassword) {
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const [rows] = await conn.query("SELECT id FROM admin_users WHERE email = ? LIMIT 1", [adminEmail]);
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    if (rows.length > 0) {
      await conn.query("UPDATE admin_users SET password_hash = ?, username = ? WHERE email = ?", [passwordHash, adminUsername, adminEmail]);
      console.log(`✅ Admin updated: ${adminUsername} (${adminEmail})`);
    } else {
      await conn.query("INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)", [adminUsername, adminEmail, passwordHash]);
      console.log(`✅ Admin created: ${adminUsername} (${adminEmail})`);
    }
  } else {
    console.log("ℹ️  ADMIN_EMAIL / ADMIN_PASSWORD not set; skipped admin seeding.");
  }

  // Seed sample categories and items
  console.log("🌱 Seeding sample data...");
  await conn.query("INSERT IGNORE INTO category (name) VALUES ('Desserts'), ('Beverages'), ('Snacks')");

  const [cats] = await conn.query("SELECT id, name FROM category");
  const catMap = {};
  cats.forEach(cat => catMap[cat.name] = cat.id);

  const sampleItems = [
    { name: 'Chocolate Cake', price: 15.99, category_id: catMap['Desserts'], image: '/choco.jpg' },
    { name: 'Pistachio Ice Cream', price: 8.50, category_id: catMap['Desserts'], image: '/pistaciofruit.jpg' },
    { name: 'Strawberry Smoothie', price: 6.99, category_id: catMap['Beverages'], image: '/straw.jpg' },
    { name: 'Vanilla Cupcake', price: 4.99, category_id: catMap['Desserts'], image: null },
    { name: 'Coffee', price: 3.50, category_id: catMap['Beverages'], image: null },
  ];

  for (const item of sampleItems) {
    await conn.query("INSERT IGNORE INTO items (name, price, category_id, image) VALUES (?, ?, ?, ?)", 
      [item.name, item.price, item.category_id, item.image]);
  }

  console.log("✅ Sample data seeded.");

  await conn.end();
}

main().catch((err) => {
  console.error("❌ init-db failed:", err);
  process.exitCode = 1;
});


