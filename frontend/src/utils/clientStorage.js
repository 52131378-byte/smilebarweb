import { apiUrl } from "./apiBase";

const KEYS = {
  clientSession: "client_session_v1",
};

function safeJsonParse(value, fallback) {
  try {
    if (value == null) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function getClientSession() {
  const raw = localStorage.getItem(KEYS.clientSession);
  const session = safeJsonParse(raw, null);
  if (!session || session.role !== "client") return null;
  return session;
}

export function isClientLoggedIn() {
  return Boolean(getClientSession());
}

export function clientLogout() {
  localStorage.removeItem(KEYS.clientSession);
}

export async function clientLogoutApi() {
  const session = getClientSession();
  const token = session?.token;

  try {
    await fetch(apiUrl("/api/client/logout"), {
      method: "POST",
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    // ignore network errors; always clear local session
  } finally {
    clientLogout();
  }

  return { ok: true };
}

function extractToken(data) {
  return (
    data?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.jwt ||
    data?.idToken ||
    data?.clientToken ||
    data?.data?.token ||
    data?.data?.accessToken ||
    data?.data?.access_token ||
    data?.data?.jwt ||
    data?.data?.clientToken ||
    ""
  );
}

function extractUser(data) {
  return (
    data?.user ||
    data?.client ||
    data?.me ||
    data?.data?.user ||
    data?.data?.client ||
    null
  );
}

export async function clientRegister({ name, email, password }) {
  const res = await fetch(apiUrl("/api/client/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name,
      username: name, // some backends expect username
      email,
      password,
    }),
  });

  const data = await readJson(res);

  if (!res.ok) {
    return {
      ok: false,
      message:
        (data && (data.message || data.error)) ||
        `Register failed (HTTP ${res.status}).`,
    };
  }

  if (data && (data.ok === false || data.success === false)) {
    return { ok: false, message: data.message || data.error || "Register failed." };
  }

  return { ok: true, data };
}

export async function clientLogin({ email, password }) {
  const res = await fetch(apiUrl("/api/client/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await readJson(res);

  if (!res.ok) {
    return {
      ok: false,
      message:
        (data && (data.message || data.error)) ||
        `Login failed (HTTP ${res.status}).`,
    };
  }

  if (data && (data.ok === false || data.success === false)) {
    return { ok: false, message: data.message || data.error || "Login failed." };
  }

  const token = extractToken(data);
  const user = extractUser(data);
  const role = user?.role || data?.role || "client";

  const session = {
    role,
    token,
    user: user
      ? {
          id: user.id || user._id,
          name: user.name || user.username,
          email: user.email,
          raw: user,
        }
      : { email },
    loggedInAt: Date.now(),
    raw: data,
  };

  // only allow client
  if (session.role !== "client") {
    return { ok: false, message: "This account is not authorized as client." };
  }

  localStorage.setItem(KEYS.clientSession, JSON.stringify(session));
  return { ok: true, session };
}

export async function clientMe() {
  const session = getClientSession();
  const token = session?.token;

  const res = await fetch(apiUrl("/api/client/me"), {
    method: "GET",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await readJson(res);

  if (!res.ok) {
    return {
      ok: false,
      message:
        (data && (data.message || data.error)) ||
        `Failed (HTTP ${res.status}).`,
    };
  }

  const user = extractUser(data) || data;
  if (session) {
    const next = {
      ...session,
      user: {
        id: user?.id || user?._id || session.user?.id,
        name: user?.name || user?.username || session.user?.name,
        email: user?.email || session.user?.email,
        raw: user,
      },
      raw: { me: data, ...(session.raw ? { prev: session.raw } : {}) },
    };
    localStorage.setItem(KEYS.clientSession, JSON.stringify(next));
  }

  return { ok: true, user };
}

export async function clientOrdersMe() {
  const session = getClientSession();
  const token = session?.token;

  const res = await fetch(apiUrl("/api/orders/me"), {
    method: "GET",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await readJson(res);

  if (!res.ok) {
    return {
      ok: false,
      message:
        (data && (data.message || data.error)) ||
        `Failed (HTTP ${res.status}).`,
    };
  }

  if (data && (data.ok === false || data.success === false)) {
    return { ok: false, message: data.message || data.error || "Failed." };
  }

  const orders =
    (Array.isArray(data) && data) ||
    (Array.isArray(data?.orders) && data.orders) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data?.data?.orders) && data.data.orders) ||
    [];

  return { ok: true, orders, raw: data };
}


