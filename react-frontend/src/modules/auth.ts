import type { User } from "../services/api";
import { validateToken } from "../services/api";

export function saveAuth(token: string, user: User) {
  localStorage.setItem("auth_token", token);
  localStorage.setItem("current_user", JSON.stringify(user));
}

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function getCurrentUser(): User | null {
  const raw = localStorage.getItem("current_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function checkAuthentication(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await validateToken(token);
    return !!res.valid;
  } catch {
    return false;
  }
}

export function logout() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("current_user");
}
