// sever.js
const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

require("dotenv").config();

const app = express();

const corsOptions = {
  origin: (origin, cb) => cb(null, true), // reflect request origin (dev-friendly)
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Handle browser preflight requests cleanly
app.options(/.*/, cors(corsOptions));
app.use(express.json());

// Local file uploads
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function verifyAdminToken(req) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: "Missing Authorization Bearer token" };
  }

  try {
    const secret = process.env.JWT_SECRET || "dev-secret-change-me";
    const payload = jwt.verify(token, secret);

    // IMPORTANT FIX:
    // adminId can be 0 (falsy), so don't validate with `!payload.adminId`.
    const adminId = Number(payload?.adminId);

    if (
      !payload ||
      typeof payload !== "object" ||
      payload.role !== "admin" ||
      !Number.isInteger(adminId) ||
      adminId < 0
    ) {
      return { ok: false, status: 403, message: "Admin token required" };
    }

    return { ok: true, payload: { ...payload, adminId } };
  } catch {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }
}

function verifyClientToken(req) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: "Missing Authorization Bearer token" };
  }

  try {
    const secret = process.env.JWT_SECRET || "dev-secret-change-me";
    const payload = jwt.verify(token, secret);

    const clientId = Number(payload?.clientId);

    if (
      !payload ||
      typeof payload !== "object" ||
      payload.role !== "client" ||
      !Number.isInteger(clientId) ||
      clientId <= 0
    ) {
      return { ok: false, status: 403, message: "Client token required" };
    }

    return { ok: true, payload: { ...payload, clientId } };
  } catch {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }
}

function requireAdmin(req, res, next) {
  const v = verifyAdminToken(req);
  if (!v.ok) return res.status(v.status).json({ message: v.message });

  const payload = v.payload;
  const jti = payload?.jti;

  if (!jti) {
    req.admin = payload;
    return next();
  }

  db.query("SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1", [jti], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (rows && rows.length > 0) return res.status(401).json({ message: "Invalid or expired token" });
    req.admin = payload;
    return next();
  });
}

function requireClient(req, res, next) {
  const v = verifyClientToken(req);
  if (!v.ok) return res.status(v.status).json({ message: v.message });

  const payload = v.payload;
  const jti = payload?.jti;

  if (!jti) {
    req.client = payload;
    return next();
  }

  db.query("SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1", [jti], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (rows && rows.length > 0) return res.status(401).json({ message: "Invalid or expired token" });
    req.client = payload;
    return next();
  });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeExt = path.extname(file.originalname || "").slice(0, 10);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

// Admin-only: upload image file (multipart/form-data with field name "image")
app.post("/api/upload", requireAdmin, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || "Upload failed" });
    if (!req.file) return res.status(400).json({ message: "image file is required" });
    return res.status(201).json({
      filename: req.file.filename,
      url: `/${req.file.filename}`,
    });
  });
});

app.post("/api/admin/register", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "email and password must be strings" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "password must be at least 6 characters" });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return res.status(400).json({ message: "invalid email" });
  }

  // If NO admins exist yet, allow open registration for the first admin.
  // If admins already exist, require a valid admin JWT to register a new admin.
  db.query("SELECT COUNT(*) AS cnt FROM admin_users", async (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });

    const cnt = rows?.[0]?.cnt ?? 0;
    if (cnt > 0) {
      const v = verifyAdminToken(req);
      if (!v.ok) return res.status(v.status).json({ message: v.message });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      db.query(
        "INSERT INTO admin_users (email, password_hash) VALUES (?, ?)",
        [email, passwordHash],
        (err2, result) => {
          if (err2) {
            if (err2.code === "ER_DUP_ENTRY") {
              return res.status(409).json({ message: "email already exists" });
            }
            return res.status(500).json({ message: "DB error" });
          }

          return res.status(201).json({
            message: "admin created",
            admin: { id: result.insertId, email },
          });
        }
      );
    } catch {
      return res.status(500).json({ message: "failed to create admin" });
    }
  });
});

app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  db.query(
    "SELECT id, email, password_hash FROM admin_users WHERE email = ? LIMIT 1",
    [email],
    async (err, rows) => {
      if (err) return res.status(500).json({ message: "DB error" });
      if (!rows || rows.length === 0) return res.status(401).json({ message: "Invalid email or password" });

      const admin = rows[0];
      const ok = await bcrypt.compare(password, admin.password_hash);
      if (!ok) return res.status(401).json({ message: "Invalid email or password" });

      const secret = process.env.JWT_SECRET || "dev-secret-change-me";
      const token = jwt.sign(
        { role: "admin", adminId: admin.id, email: admin.email, jti: crypto.randomUUID() },
        secret,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        admin: { id: admin.id, email: admin.email },
      });
    }
  );
});

// Client auth: register (public)
app.post("/api/client/register", (req, res) => {
  const { name, email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "email and password must be strings" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "password must be at least 6 characters" });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return res.status(400).json({ message: "invalid email" });
  }

  const trimmedName = typeof name === "string" && name.trim() ? name.trim().slice(0, 255) : null;
  const trimmedEmail = email.trim().toLowerCase();

  bcrypt
    .hash(password, 10)
    .then((passwordHash) => {
      db.query(
        "INSERT INTO clients (name, email, password_hash) VALUES (?, ?, ?)",
        [trimmedName, trimmedEmail, passwordHash],
        (err, result) => {
          if (err) {
            if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "email already exists" });
            if (err.code === "ER_NO_SUCH_TABLE")
              return res.status(500).json({ message: "clients table not found; run init-db" });
            return res.status(500).json({ message: "DB error" });
          }

          const secret = process.env.JWT_SECRET || "dev-secret-change-me";
          const token = jwt.sign(
            { role: "client", clientId: result.insertId, email: trimmedEmail, jti: crypto.randomUUID() },
            secret,
            { expiresIn: "7d" }
          );

          return res.status(201).json({
            token,
            client: { id: result.insertId, name: trimmedName, email: trimmedEmail },
          });
        }
      );
    })
    .catch(() => res.status(500).json({ message: "failed to create client" }));
});

// Client auth: login (public)
app.post("/api/client/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!trimmedEmail) return res.status(400).json({ message: "email is required" });

  db.query(
    "SELECT id, name, email, password_hash FROM clients WHERE email = ? LIMIT 1",
    [trimmedEmail],
    async (err, rows) => {
      if (err) {
        if (err.code === "ER_NO_SUCH_TABLE")
          return res.status(500).json({ message: "clients table not found; run init-db" });
        return res.status(500).json({ message: "DB error" });
      }
      if (!rows || rows.length === 0) return res.status(401).json({ message: "Invalid email or password" });

      const client = rows[0];
      const ok = await bcrypt.compare(password, client.password_hash);
      if (!ok) return res.status(401).json({ message: "Invalid email or password" });

      const secret = process.env.JWT_SECRET || "dev-secret-change-me";
      const token = jwt.sign(
        { role: "client", clientId: client.id, email: client.email, jti: crypto.randomUUID() },
        secret,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        client: { id: client.id, name: client.name, email: client.email },
      });
    }
  );
});

// Client auth: "me" (requires client token)
app.get("/api/client/me", requireClient, (req, res) => {
  const clientId = Number(req.client.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) return res.status(401).json({ message: "Invalid token" });

  db.query("SELECT id, name, email, created_at FROM clients WHERE id = ? LIMIT 1", [clientId], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!rows || rows.length === 0) return res.status(404).json({ message: "client not found" });
    return res.json(rows[0]);
  });
});

// Client logout (requires client token)
app.post("/api/client/logout", requireClient, (req, res) => {
  const jti = req.client?.jti;
  const exp = req.client?.exp;

  if (!jti) return res.json({ message: "logged out" });

  const expiresAt = typeof exp === "number" ? new Date(exp * 1000) : null;
  db.query("INSERT INTO revoked_tokens (jti, expires_at) VALUES (?, ?)", [jti, expiresAt], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") return res.json({ message: "logged out" });
      return res.status(500).json({ message: "DB error" });
    }
    return res.json({ message: "logged out" });
  });
});

// Admin logout (requires admin token)
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  const jti = req.admin?.jti;
  const exp = req.admin?.exp;

  if (!jti) return res.json({ message: "logged out" });

  const expiresAt = typeof exp === "number" ? new Date(exp * 1000) : null;
  db.query("INSERT INTO revoked_tokens (jti, expires_at) VALUES (?, ?)", [jti, expiresAt], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") return res.json({ message: "logged out" });
      return res.status(500).json({ message: "DB error" });
    }
    return res.json({ message: "logged out" });
  });
});

function cleanString(v, maxLen) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, maxLen);
}

function toPositiveInt(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// Checkout: create order (requires client token)
app.post("/api/orders", requireClient, (req, res) => {
  const clientId = toPositiveInt(req.client?.clientId);
  if (!clientId) return res.status(401).json({ message: "Invalid token" });

  const body = req.body || {};
  const fullName = cleanString(body.full_name, 255);
  const phone = cleanString(body.phone, 50);
  const address = cleanString(body.address, 500);
  const city = cleanString(body.city, 255);
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null;
  const paymentMethod =
    typeof body.payment_method === "string" && body.payment_method.trim()
      ? body.payment_method.trim().slice(0, 50)
      : "cash_on_delivery";

  if (!fullName || !phone || !address || !city) {
    return res.status(400).json({ message: "full_name, phone, address, city are required" });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return res.status(400).json({ message: "items is required" });
  if (rawItems.length > 200) return res.status(400).json({ message: "too many items" });

  const qtyByItemId = new Map();
  for (const it of rawItems) {
    const itemId = toPositiveInt(it?.item_id);
    const qty = toPositiveInt(it?.quantity);
    if (!itemId || !qty)
      return res.status(400).json({ message: "each item must have item_id and quantity (positive integers)" });
    qtyByItemId.set(itemId, (qtyByItemId.get(itemId) || 0) + qty);
  }
  const itemIds = Array.from(qtyByItemId.keys());

  db.query("SELECT id, name, price, stock_quantity FROM items WHERE id IN (?)", [itemIds], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    const found = rows || [];
    if (found.length !== itemIds.length) {
      const foundIds = new Set(found.map((r) => r.id));
      const missing = itemIds.filter((id) => !foundIds.has(id));
      return res.status(400).json({ message: "some items not found", missing_item_ids: missing });
    }

    for (const r of found) {
      const qty = qtyByItemId.get(r.id) || 0;
      const stock = Number(r.stock_quantity);
      if (Number.isFinite(stock) && stock >= 0 && qty > stock) {
        return res.status(400).json({
          message: "out of stock",
          item_id: r.id,
          requested: qty,
          available: stock,
        });
      }
    }

    const orderItems = found.map((r) => {
      const qty = qtyByItemId.get(r.id) || 0;
      const unitPrice = Number(r.price);
      const lineTotal = Number((unitPrice * qty).toFixed(2));
      return {
        item_id: r.id,
        name: String(r.name || "").slice(0, 255),
        unit_price: Number(unitPrice.toFixed(2)),
        quantity: qty,
        line_total: lineTotal,
      };
    });

    const subtotal = Number(orderItems.reduce((sum, it) => sum + it.line_total, 0).toFixed(2));
    const shipping = 0.0;
    const total = Number((subtotal + shipping).toFixed(2));

    db.beginTransaction((txErr) => {
      if (txErr) return res.status(500).json({ message: "DB error" });

      const insertOrderSql = `
        INSERT INTO orders
          (client_id, full_name, phone, address, city, notes, payment_method, status, subtotal, shipping, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `;
      const insertOrderParams = [clientId, fullName, phone, address, city, notes, paymentMethod, subtotal, shipping, total];

      db.query(insertOrderSql, insertOrderParams, (err1, result1) => {
        if (err1) {
          return db.rollback(() => res.status(500).json({ message: "DB error" }));
        }
        const orderId = result1.insertId;

        const updates = orderItems.slice();
        const decOne = (idx) => {
          if (idx >= updates.length) return afterStock();
          const it = updates[idx];
          db.query(
            "UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?",
            [it.quantity, it.item_id, it.quantity],
            (uErr, uRes) => {
              if (uErr) return db.rollback(() => res.status(500).json({ message: "DB error" }));
              if (!uRes || uRes.affectedRows !== 1) {
                return db.rollback(() =>
                  res.status(400).json({
                    message: "out of stock",
                    item_id: it.item_id,
                    requested: it.quantity,
                  })
                );
              }
              return decOne(idx + 1);
            }
          );
        };

        const afterStock = () => {
          const insertItemSql =
            "INSERT INTO order_items (order_id, item_id, name, unit_price, quantity, line_total) VALUES ?";
          const values = orderItems.map((it) => [orderId, it.item_id, it.name, it.unit_price, it.quantity, it.line_total]);

          db.query(insertItemSql, [values], (err2) => {
            if (err2) {
              return db.rollback(() => res.status(500).json({ message: "DB error" }));
            }

            db.commit((err3) => {
              if (err3) {
                return db.rollback(() => res.status(500).json({ message: "DB error" }));
              }
              return res.status(201).json({
                id: orderId,
                status: "pending",
                payment_method: paymentMethod,
                subtotal,
                shipping,
                total,
                items: orderItems,
              });
            });
          });
        };

        return decOne(0);
      });
    });
  });
});

// Client: list your orders (requires client token)
app.get("/api/orders/me", requireClient, (req, res) => {
  const clientId = toPositiveInt(req.client?.clientId);
  if (!clientId) return res.status(401).json({ message: "Invalid token" });

  db.query("SELECT * FROM orders WHERE client_id = ? ORDER BY created_at DESC", [clientId], (err, orders) => {
    if (err) return res.status(500).json({ message: "DB error" });
    const rows = orders || [];
    if (rows.length === 0) return res.json([]);

    const orderIds = rows.map((o) => o.id);
    db.query(
      "SELECT * FROM order_items WHERE order_id IN (?) ORDER BY order_id ASC, id ASC",
      [orderIds],
      (err2, items) => {
        if (err2) return res.status(500).json({ message: "DB error" });
        const byOrder = new Map();
        for (const it of items || []) {
          if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
          byOrder.get(it.order_id).push(it);
        }
        return res.json(rows.map((o) => ({ ...o, items: byOrder.get(o.id) || [] })));
      }
    );
  });
});

// Admin: list all orders (requires admin token)
app.get("/api/orders", requireAdmin, (req, res) => {
  db.query(
    `
      SELECT
        o.*,
        c.email AS client_email,
        c.name AS client_name
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      ORDER BY o.created_at DESC
    `,
    (err, orders) => {
      if (err) return res.status(500).json({ message: "DB error" });
      const rows = orders || [];
      if (rows.length === 0) return res.json([]);

      const orderIds = rows.map((o) => o.id);
      db.query(
        "SELECT * FROM order_items WHERE order_id IN (?) ORDER BY order_id ASC, id ASC",
        [orderIds],
        (err2, items) => {
          if (err2) return res.status(500).json({ message: "DB error" });
          const byOrder = new Map();
          for (const it of items || []) {
            if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
            byOrder.get(it.order_id).push(it);
          }
          return res.json(rows.map((o) => ({ ...o, items: byOrder.get(o.id) || [] })));
        }
      );
    }
  );
});

// Admin-only: create category
app.post("/api/categories", requireAdmin, (req, res) => {
  const { name } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "name is required" });
  }

  db.query("INSERT INTO category (name) VALUES (?)", [name.trim()], (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "category already exists" });
      return res.status(500).json({ message: "DB error" });
    }
    return res.status(201).json({ id: result.insertId, name: name.trim() });
  });
});

// Admin-only: delete category
app.delete("/api/categories/:id", requireAdmin, (req, res) => {
  const categoryId = Number(req.params.id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ message: "id must be a positive integer" });
  }

  db.query("SELECT COUNT(*) AS cnt FROM items WHERE category_id = ?", [categoryId], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    const cnt = Number(rows?.[0]?.cnt ?? 0);
    if (cnt > 0) {
      return res.status(409).json({ message: "category cannot be deleted because it has items" });
    }

    db.query("DELETE FROM category WHERE id = ? LIMIT 1", [categoryId], (err2, result2) => {
      if (err2) return res.status(500).json({ message: "DB error" });
      if (!result2 || result2.affectedRows !== 1) return res.status(404).json({ message: "category not found" });
      return res.json({ message: "category deleted" });
    });
  });
});

// Admin-only: create product/item
app.post("/api/items", requireAdmin, (req, res) => {
  const { name, price, image, category_id, stock_quantity } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "name is required" });
  }

  const parsedPrice = Number(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ message: "price must be a valid number >= 0" });
  }

  const parsedCategoryId = Number(category_id);
  if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
    return res.status(400).json({ message: "category_id must be a positive integer" });
  }

  let parsedStockQty = 1000000;
  if (stock_quantity !== undefined && stock_quantity !== null && stock_quantity !== "") {
    parsedStockQty = Number(stock_quantity);
    if (!Number.isInteger(parsedStockQty) || parsedStockQty < 0) {
      return res.status(400).json({ message: "stock_quantity must be an integer >= 0" });
    }
  }

  db.query("SELECT id FROM category WHERE id = ? LIMIT 1", [parsedCategoryId], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!rows || rows.length === 0) return res.status(400).json({ message: "category_id not found" });

    db.query(
      "INSERT INTO items (name, price, stock_quantity, image, category_id) VALUES (?, ?, ?, ?, ?)",
      [name.trim(), parsedPrice, parsedStockQty, image || null, parsedCategoryId],
      (err2, result) => {
        if (err2) return res.status(500).json({ message: "DB error" });
        return res.status(201).json({
          id: result.insertId,
          name: name.trim(),
          price: parsedPrice,
          stock_quantity: parsedStockQty,
          image: image || null,
          category_id: parsedCategoryId,
        });
      }
    );
  });
});

// Admin-only: delete product/item
app.delete("/api/items/:id", requireAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ message: "id must be a positive integer" });
  }

  db.query("SELECT image FROM items WHERE id = ? LIMIT 1", [itemId], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!rows || rows.length === 0) return res.status(404).json({ message: "item not found" });

    const image = rows[0].image;

    db.query("DELETE FROM items WHERE id = ? LIMIT 1", [itemId], (err2, result2) => {
      if (err2) {
        if (err2.code === "ER_ROW_IS_REFERENCED_2") {
          return res.status(409).json({ message: "item cannot be deleted because it is referenced by orders" });
        }
        return res.status(500).json({ message: "DB error" });
      }
      if (!result2 || result2.affectedRows !== 1) return res.status(404).json({ message: "item not found" });

      try {
        if (typeof image === "string" && image) {
          const normalized = image.startsWith("http") ? null : image;
          const isUploadsPath = normalized && (normalized.startsWith("/") || normalized.startsWith("/"));
          if (isUploadsPath) {
            const filename = path.basename(normalized);
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        }
      } catch {
        // ignore
      }

      return res.json({ message: "item deleted" });
    });
  });
});


// Guest checkout: create order WITHOUT login
// app.post("/app/api/orders", (req, res) => {
//   const body = req.body || {};

//   const fullName = cleanString(body.full_name, 255);
//   const phone = cleanString(body.phone, 50);
//   const address = cleanString(body.address, 500);
//   const city = cleanString(body.city, 255);
//   const notes =
//     typeof body.notes === "string" && body.notes.trim()
//       ? body.notes.trim().slice(0, 2000)
//       : null;

//   const paymentMethod =
//     typeof body.payment_method === "string" && body.payment_method.trim()
//       ? body.payment_method.trim().slice(0, 50)
//       : "cash_on_delivery";

//   if (!fullName || !phone || !address || !city) {
//     return res
//       .status(400)
//       .json({ message: "full_name, phone, address, city are required" });
//   }

//   const rawItems = Array.isArray(body.items) ? body.items : [];
//   if (rawItems.length === 0) return res.status(400).json({ message: "items is required" });
//   if (rawItems.length > 200) return res.status(400).json({ message: "too many items" });

//   // normalize + merge duplicates
//   const qtyByItemId = new Map();
//   for (const it of rawItems) {
//     const itemId = toPositiveInt(it?.item_id);
//     const qty = toPositiveInt(it?.quantity);
//     if (!itemId || !qty) {
//       return res
//         .status(400)
//         .json({ message: "each item must have item_id and quantity (positive integers)" });
//     }
//     qtyByItemId.set(itemId, (qtyByItemId.get(itemId) || 0) + qty);
//   }
//   const itemIds = Array.from(qtyByItemId.keys());

//   // Load items from DB to compute totals (prevents client-side price tampering)
//   db.query(
//     "SELECT id, name, price, stock_quantity FROM items WHERE id IN (?)",
//     [itemIds],
//     (err, rows) => {
//       if (err) return res.status(500).json({ message: "DB error" });

//       const found = rows || [];
//       if (found.length !== itemIds.length) {
//         const foundIds = new Set(found.map((r) => r.id));
//         const missing = itemIds.filter((id) => !foundIds.has(id));
//         return res.status(400).json({ message: "some items not found", missing_item_ids: missing });
//       }

//       // Pre-check stock (final enforcement happens in the transaction below)
//       for (const r of found) {
//         const qty = qtyByItemId.get(r.id) || 0;
//         const stock = Number(r.stock_quantity);
//         if (Number.isFinite(stock) && stock >= 0 && qty > stock) {
//           return res.status(400).json({
//             message: "out of stock",
//             item_id: r.id,
//             requested: qty,
//             available: stock,
//           });
//         }
//       }

//       const orderItems = found.map((r) => {
//         const qty = qtyByItemId.get(r.id) || 0;
//         const unitPrice = Number(r.price);
//         const lineTotal = Number((unitPrice * qty).toFixed(2));
//         return {
//           item_id: r.id,
//           name: String(r.name || "").slice(0, 255),
//           unit_price: Number(unitPrice.toFixed(2)),
//           quantity: qty,
//           line_total: lineTotal,
//         };
//       });

//       const subtotal = Number(orderItems.reduce((sum, it) => sum + it.line_total, 0).toFixed(2));
//       const shipping = 0.0;
//       const total = Number((subtotal + shipping).toFixed(2));

//       db.beginTransaction((txErr) => {
//         if (txErr) return res.status(500).json({ message: "DB error" });

//         // IMPORTANT:
//         // This requires orders.client_id to allow NULL (guest orders).
//         const insertOrderSql = `
//           INSERT INTO orders
//             (client_id, full_name, phone, address, city, notes, payment_method, status, subtotal, shipping, total)
//           VALUES (NULL, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
//         `;
//         const insertOrderParams = [
//           fullName,
//           phone,
//           address,
//           city,
//           notes,
//           paymentMethod,
//           subtotal,
//           shipping,
//           total,
//         ];

//         db.query(insertOrderSql, insertOrderParams, (err1, result1) => {
//           if (err1) {
//             return db.rollback(() => res.status(500).json({ message: "DB error" }));
//           }

//           const orderId = result1.insertId;

//           // Enforce + decrement stock inside the transaction to avoid race conditions
//           const decOne = (idx) => {
//             if (idx >= orderItems.length) return afterStock();
//             const it = orderItems[idx];

//             db.query(
//               "UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?",
//               [it.quantity, it.item_id, it.quantity],
//               (uErr, uRes) => {
//                 if (uErr) return db.rollback(() => res.status(500).json({ message: "DB error" }));
//                 if (!uRes || uRes.affectedRows !== 1) {
//                   return db.rollback(() =>
//                     res.status(400).json({
//                       message: "out of stock",
//                       item_id: it.item_id,
//                       requested: it.quantity,
//                     })
//                   );
//                 }
//                 return decOne(idx + 1);
//               }
//             );
//           };

//           const afterStock = () => {
//             const insertItemSql =
//               "INSERT INTO order_items (order_id, item_id, name, unit_price, quantity, line_total) VALUES ?";

//             const values = orderItems.map((it) => [
//               orderId,
//               it.item_id,
//               it.name,
//               it.unit_price,
//               it.quantity,
//               it.line_total,
//             ]);

//             db.query(insertItemSql, [values], (err2) => {
//               if (err2) {
//                 return db.rollback(() => res.status(500).json({ message: "DB error" }));
//               }

//               db.commit((err3) => {
//                 if (err3) {
//                   return db.rollback(() => res.status(500).json({ message: "DB error" }));
//                 }

//                 return res.status(201).json({
//                   id: orderId,
//                   status: "pending",
//                   payment_method: paymentMethod,
//                   subtotal,
//                   shipping,
//                   total,
//                   items: orderItems,
//                 });
//               });
//             });
//           };

//           return decOne(0);
//         });
//       });
//     }
//   );
// });

// Public: list items
app.get("/api/items", (_req, res) => {
  const sql = `
    SELECT
      items.id,
      items.name,
      items.price,
      items.stock_quantity,
      items.image,
      category.name AS category
    FROM items
    JOIN category ON items.category_id = category.id
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Public: list categories
app.get("/api/categories", (_req, res) => {
  db.query("SELECT * FROM category", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Public: submit feedback
app.post("/api/feedback", (req, res) => {
  const { fname, lname, name, email, message, rating } = req.body || {};

  const hasFname = typeof fname === "string" && fname.trim();
  const hasLname = typeof lname === "string" && lname.trim();
  const hasName = typeof name === "string" && name.trim();

  if (!hasName && !hasFname) {
    return res.status(400).json({ message: "fname (or name) is required" });
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ message: "message is required" });
  }

  const trimmedFname = hasFname ? fname.trim().slice(0, 255) : null;
  const trimmedLname = hasLname ? lname.trim().slice(0, 255) : null;
  const derivedName = [trimmedFname, trimmedLname].filter(Boolean).join(" ").trim();
  const trimmedName = (hasName ? name.trim() : derivedName).slice(0, 255) || null;
  const trimmedEmail = typeof email === "string" && email.trim() ? email.trim().slice(0, 320) : null;
  const trimmedMessage = message.trim();

  let parsedRating = null;
  if (rating !== undefined && rating !== null && rating !== "") {
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: "rating must be an integer between 1 and 5" });
    }
    parsedRating = r;
  }

  const insertWithNamesSql =
    "INSERT INTO feedback (fname, lname, name, email, message, rating) VALUES (?, ?, ?, ?, ?, ?)";
  const insertWithNamesParams = [trimmedFname, trimmedLname, trimmedName, trimmedEmail, trimmedMessage, parsedRating];

  db.query(insertWithNamesSql, insertWithNamesParams, (err, result) => {
    if (err) {
      if (err.code === "ER_BAD_FIELD_ERROR") {
        return db.query(
          "INSERT INTO feedback (name, email, message, rating) VALUES (?, ?, ?, ?)",
          [trimmedName, trimmedEmail, trimmedMessage, parsedRating],
          (err2, result2) => {
            if (err2) return res.status(500).json({ message: "DB error" });
            return res.status(201).json({
              id: result2.insertId,
              fname: trimmedFname,
              lname: trimmedLname,
              name: trimmedName,
              email: trimmedEmail,
              message: trimmedMessage,
              rating: parsedRating,
            });
          }
        );
      }
      return res.status(500).json({ message: "DB error" });
    }

    return res.status(201).json({
      id: result.insertId,
      fname: trimmedFname,
      lname: trimmedLname,
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage,
      rating: parsedRating,
    });
  });
});

// Admin-only: list recent feedback
app.get("/api/feedback", requireAdmin, (req, res) => {
  db.query("SELECT * FROM feedback ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    return res.json(rows || []);
  });
});

// 404 handler
app.use((_req, res) => {
  return res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  if (err && typeof err === "object" && err.message) {
    return res.status(400).json({ message: String(err.message) });
  }
  return res.status(500).json({ message: "Server error" });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});