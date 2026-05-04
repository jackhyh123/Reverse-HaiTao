"use client";

import { ExternalLink, FileText, FolderOpen } from "lucide-react";
import type { NodeResource } from "@/lib/knowledge-graph";

type LocaleKey = "zh" | "en";

export function uniqueResources(resources: NodeResource[]): NodeResource[] {
  const seen = new Set<string>();
  return resources.filter((resource) => {
    const key = resource.url || resource.title.zh;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ResourceDesktop({
  locale,
  leftResources,
  rightResources,
  rightTitle,
  onOpenResource,
}: {
  locale: LocaleKey;
  leftResources: NodeResource[];
  rightResources: NodeResource[];
  rightTitle?: string;
  onOpenResource?: (url: string, title: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-8 z-10 hidden justify-between gap-4 md:flex">
      <ResourceStack
        locale={locale}
        title={locale === "zh" ? "开始前必读" : "Start Here"}
        subtitle={locale === "zh" ? "先校准概念，再进入节点" : "Calibrate the basics before nodes"}
        resources={leftResources}
        align="left"
        onOpenResource={onOpenResource}
      />
      <ResourceStack
        locale={locale}
        title={rightTitle || (locale === "zh" ? "当前路径资料" : "Track Files")}
        subtitle={rightTitle ? (locale === "zh" ? "当前节点的资料" : "Current node files") : (locale === "zh" ? "点击节点后切换资料" : "Click a node to switch files")}
        resources={rightResources}
        align="right"
        onOpenResource={onOpenResource}
      />
    </div>
  );
}

export function ResourceStack({
  locale,
  title,
  subtitle,
  resources,
  align,
  onOpenResource,
}: {
  locale: LocaleKey;
  title: string;
  subtitle: string;
  resources: NodeResource[];
  align: "left" | "right";
  onOpenResource?: (url: string, title: string) => void;
}) {
  if (resources.length === 0) return null;
  return (
    <section
      className={`pointer-events-auto w-[188px] rounded-[24px] border border-[var(--border)]/35 bg-[var(--background)]/58 p-2.5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-slate-950/50 lg:w-[220px] xl:w-[240px] ${
        align === "right" ? "translate-y-10" : ""
      }`}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-300/20 dark:text-amber-200">
          <FolderOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-black">{title}</div>
          <div className="truncate text-[11px] text-[var(--muted-foreground)]">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-2">
        {resources.map((resource, index) => {
          const isFeishu = resource.url?.includes("feishu.cn");
          return (
            <button
              key={`${resource.url}-${resource.title[locale]}`}
              onClick={() => {
                if (isFeishu) {
                  window.open(resource.url, "_blank", "noopener,noreferrer");
                } else {
                  onOpenResource?.(resource.url, resource.title[locale]);
                }
              }}
              className="group block w-full text-left"
              style={{ transform: `rotate(${align === "left" ? -1.5 + index * 1.2 : 1.5 - index * 1.1}deg)` }}
            >
              <div className={`relative overflow-hidden rounded-2xl border border-[var(--border)]/45 bg-[var(--background)]/86 p-2.5 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl dark:bg-slate-900/86 lg:p-3 ${
                isFeishu
                  ? "opacity-70 group-hover:opacity-90 group-hover:border-[var(--border)]/60"
                  : "group-hover:border-[var(--primary)]/50"
              }`}>
                <div className={`absolute right-0 top-0 h-8 w-8 rounded-bl-2xl ${isFeishu ? "bg-slate-100 dark:bg-slate-700/30" : "bg-amber-100 dark:bg-amber-300/20"}`} />
                <div className="flex items-start gap-2">
                  <FileText className={`mt-0.5 h-4 w-4 shrink-0 ${isFeishu ? "text-[var(--muted-foreground)]" : "text-[var(--primary)]"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-xs font-black leading-5">
                      {resource.title[locale]}
                    </div>
                    {isFeishu ? (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                        <ExternalLink className="h-3 w-3" />
                        查看飞书原文
                      </div>
                    ) : resource.summary?.[locale] && (
                      <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--muted-foreground)]">
                        {resource.summary[locale]}
                      </div>
                    )}
                  </div>
                  <ExternalLink className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isFeishu ? "text-[var(--muted-foreground)]" : "text-[var(--muted-foreground)] opacity-60 transition-opacity group-hover:opacity-100"}`} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
