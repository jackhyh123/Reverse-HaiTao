"use client";

import { apiUrl } from "@/lib/api";

export interface AuthUser {
  email: string;
  role: "admin" | "member";
  is_admin: boolean;
  expires_at?: number | null;
}

export interface AuthMember {
  email: string;
  created_at: number;
  last_login_at: number;
  login_count: number;
  status: string;
  note?: string;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user?: AuthUser;
  member?: AuthMember | null;
}

const COMMON: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
};

export async function authMe(): Promise<AuthMeResponse> {
  const r = await fetch(apiUrl("/api/v1/auth/me"), {
    ...COMMON,
    cache: "no-store",
  });
  if (!r.ok) return { authenticated: false };
  return (await r.json()) as AuthMeResponse;
}

export async function authSendCode(email: string): Promise<{
  success: boolean;
  message: string;
  dev_mode?: boolean;
}> {
  const r = await fetch(apiUrl("/api/v1/auth/send-code"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    return { success: false, message: err.detail || `HTTP ${r.status}` };
  }
  return (await r.json()) as { success: boolean; message: string; dev_mode?: boolean };
}

export async function authVerify(
  email: string,
  code: string,
): Promise<{ user: AuthUser; member?: AuthMember }> {
  const r = await fetch(apiUrl("/api/v1/auth/verify"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `HTTP ${r.status}`);
  }
  const data = (await r.json()) as {
    user: AuthUser & { member?: AuthMember };
  };
  return { user: data.user, member: data.user.member };
}

export async function authLogout(): Promise<void> {
  await fetch(apiUrl("/api/v1/auth/logout"), {
    ...COMMON,
    method: "POST",
  });
}
