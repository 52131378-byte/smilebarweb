const USERS_KEY = "users_v1";
const SESSION_KEY = "client_session_v1";

function safeJsonParse(value, fallback) {
  try {
    if (value == null) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function readUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getClientSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return safeJsonParse(raw, null);
}

export function isClientLoggedIn() {
  const session = getClientSession();
  return Boolean(session?.user?.id);
}

export function clientLogin({ email, password }) {
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedPassword = String(password || "");

  if (!trimmedEmail) return { ok: false, message: "Email is required." };
  if (!trimmedEmail.includes("@"))
    return { ok: false, message: "Email is not valid." };
  if (!trimmedPassword) return { ok: false, message: "Password is required." };

  const users = readUsers();
  const user = users.find((u) => u.email === trimmedEmail);
  if (!user) return { ok: false, message: "Account not found." };
  if (user.password !== trimmedPassword)
    return { ok: false, message: "Incorrect password." };

  const session = {
    user: { id: user.id, name: user.name, email: user.email },
    loggedInAt: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return { ok: true, session };
}

export function clientLogout() {
  localStorage.removeItem(SESSION_KEY);
}


