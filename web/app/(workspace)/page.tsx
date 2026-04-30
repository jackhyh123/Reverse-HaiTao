"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Root page:
 *   - 默认 → 自动跳转到 /learn（知识图谱学习就是首页，未登录也可看）
 *   - 兼容 /?session=xxx 老链接 → 跳到 /chat/:id
 */
export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const capability = searchParams.get("capability");
  const tools = searchParams.getAll("tool");

  // 老链接兼容
  useEffect(() => {
    if (!sessionId) return;
    let target = `/chat/${sessionId}`;
    const query: string[] = [];
    if (capability) query.push(`capability=${encodeURIComponent(capability)}`);
    tools.forEach((tool: string) =>
      query.push(`tool=${encodeURIComponent(tool)}`),
    );
    if (query.length) target += `?${query.join("&")}`;
    router.replace(target);
  }, [capability, router, sessionId, tools]);

  // 知识图谱学习就是默认首页；AI 导师等互动功能再要求登录。
  useEffect(() => {
    if (sessionId) return;
    router.replace("/learn");
  }, [sessionId, router]);

  return null;
}
