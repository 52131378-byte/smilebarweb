import { apiUrl } from "./apiBase";

const KEYS = {
  adminSession: "admin_session_v1",
  adminToken: "admin_token_v1",
  categories: "admin_categories_v1",
  products: "admin_products_v1",
};

export const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123",
};

function makeId() {
  try {
    if (window?.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    // ignore
  }
  return String(Date.now());
}

function safeJsonParse(value, fallback) {
  try {
    if (value == null) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readArray(key) {
  const raw = localStorage.getItem(key);
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeArray(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

export function getAdminSession() {
  const raw = localStorage.getItem(KEYS.adminSession);
  const session = safeJsonParse(raw, null);
  if (!session || session.role !== "admin") {
    // If a token was stored separately, reconstruct a minimal session.
    const token = localStorage.getItem(KEYS.adminToken);
    if (token) {
      const next = {
        role: "admin",
        username: "admin",
        token,
        loggedInAt: Date.now(),
        raw: null,
      };
      localStorage.setItem(KEYS.adminSession, JSON.stringify(next));
      return next;
    }
    return null;
  }

  // Back-compat / convenience: if token was stored separately, hydrate session.token.
  if (!session.token) {
    const token = localStorage.getItem(KEYS.adminToken);
    if (token) {
      const next = { ...session, token };
      localStorage.setItem(KEYS.adminSession, JSON.stringify(next));
      return next;
    }
  }

  return session;
}

export function getAdminToken() {
  const s = getAdminSession();
  return (
    s?.token ||
    localStorage.getItem(KEYS.adminToken) ||
    ""
  );
}

export function isAdminLoggedIn() {
  return Boolean(getAdminToken());
}

function extractToken(data) {
  return (
    data?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.jwt ||
    data?.idToken ||
    data?.adminToken ||
    data?.user?.token ||
    data?.admin?.token ||
    data?.user?.accessToken ||
    data?.admin?.accessToken ||
    data?.user?.access_token ||
    data?.admin?.access_token ||
    data?.data?.user?.token ||
    data?.data?.admin?.token ||
    data?.data?.token ||
    data?.data?.accessToken ||
    data?.data?.access_token ||
    data?.data?.jwt ||
    data?.data?.adminToken ||
    ""
  );
}

export async function adminLogin({ email, password }) {
  const res = await fetch(apiUrl("/api/admin/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await safeJsonParse(await res.text(), null);

  if (!res.ok) {
    return {
      ok: false,
      message:
        (data && (data.message || data.error)) ||
        `Login failed (HTTP ${res.status}).`,
    };
  }

  // accept common shapes:
  // - { token, user: { username, role } }
  // - { accessToken, admin: { username } }
  // - { ok: true, ... }
  if (data && (data.ok === false || data.success === false)) {
    return {
      ok: false,
      message: data.message || data.error || "Login failed.",
    };
  }

  const token = extractToken(data);
  const role =
    data?.user?.role || data?.admin?.role || data?.role || "admin";
  const resolvedUsername =
    data?.user?.username ||
    data?.admin?.username ||
    data?.user?.email ||
    data?.admin?.email ||
    email;

  const session = {
    role,
    username: resolvedUsername,
    token,
    loggedInAt: Date.now(),
    raw: data,
  };

  // only allow admin
  if (session.role !== "admin") {
    return { ok: false, message: "You are not authorized as admin." };
  }

  if (!session.token) {
    return {
      ok: false,
      message:
        "Login succeeded but no token was returned by the API. Please verify the /api/admin/login response includes a token field.",
    };
  }

  localStorage.setItem(KEYS.adminSession, JSON.stringify(session));
  localStorage.setItem(KEYS.adminToken, String(session.token));
  return { ok: true, session };
}

export async function adminRegister({ username, email, password }) {
  const res = await fetch(apiUrl("/api/admin/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email,
      password,
    }),
  });

  const data = await safeJsonParse(await res.text(), null);

  if (!res.ok) {
    return {
      ok: false,
      message:
        (data && (data.message || data.error)) ||
        `Register failed (HTTP ${res.status}).`,
    };
  }

  if (data && (data.ok === false || data.success === false)) {
    return {
      ok: false,
      message: data.message || data.error || "Register failed.",
    };
  }

  return { ok: true, data };
}

export function adminLogout() {
  localStorage.removeItem(KEYS.adminSession);
  localStorage.removeItem(KEYS.adminToken);
}

export async function adminLogoutApi() {
  const session = getAdminSession();
  const token = session?.token;

  try {
    await fetch(apiUrl("/api/admin/logout"), {
      method: "POST",
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    // ignore network errors; always clear local session
  } finally {
    adminLogout();
  }

  return { ok: true };
}

export function getCategories() {
  return readArray(KEYS.categories);
}

export function createCategory({ name }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return { ok: false, message: "Category name is required." };

  const categories = getCategories();
  const exists = categories.some(
    (c) => String(c.name).toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) return { ok: false, message: "Category already exists." };

  const newCategory = {
    id: makeId(),
    name: trimmed,
    createdAt: Date.now(),
  };
  const next = [newCategory, ...categories];
  writeArray(KEYS.categories, next);
  return { ok: true, category: newCategory };
}

export function deleteCategory(id) {
  const categories = getCategories().filter((c) => c.id !== id);
  writeArray(KEYS.categories, categories);

  // also detach products from deleted category
  const products = getProducts().map((p) =>
    p.categoryId === id ? { ...p, categoryId: "" } : p
  );
  writeArray(KEYS.products, products);
}

export function getProducts() {
  return readArray(KEYS.products);
}

export function createProduct({ name, price, image, categoryId }) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) return { ok: false, message: "Product name is required." };

  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice) || numericPrice <= 0) {
    return { ok: false, message: "Price must be a number greater than 0." };
  }

  const trimmedImage = String(image || "").trim();

  const newProduct = {
    id: makeId(),
    name: trimmedName,
    price: numericPrice,
    image: trimmedImage || "/logo.png",
    categoryId: categoryId || "",
    createdAt: Date.now(),
  };

  const products = getProducts();
  const next = [newProduct, ...products];
  writeArray(KEYS.products, next);
  return { ok: true, product: newProduct };
}

export function deleteProduct(id) {
  const products = getProducts().filter((p) => p.id !== id);
  writeArray(KEYS.products, products);
}


