"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  GraduationCap,
  Network,
  RefreshCcw,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "@/lib/api";

interface SystemStatus {
  backend: { status: string; timestamp?: string };
  llm: { status: string; model?: string | null; error?: string };
  embeddings: { status: string; model?: string | null; error?: string };
  search: { status: string; provider?: string | null };
}

interface KnowledgeBaseConfig {
  knowledge_bases: Record<string, {
    name?: string;
    document_count?: number;
    total_size_bytes?: number;
    rag_provider?: string;
    last_updated?: string;
  }>;
}

interface CurriculumPayload {
  curriculum: {
    tracks: Array<{
      id: string;
      gates: unknown[];
      badge?: { zh: string; en: string };
    }>;
  };
}

interface GraphPayload {
  graph: {
    tracks: Array<{ id: string; label?: { zh: string; en: string } }>;
    nodes: Array<{ id: string; track_ids: string[] }>;
  };
}

function StatusDot({ status }: { status: string }) {
  const ok = status === "online" || status === "configured";
  const warn =
    status === "fallback" || status === "deprecated" || status === "optional";
  const color = ok
    ? "bg-emerald-500"
    : warn
    ? "bg-amber-500"
    : status === "unknown"
    ? "bg-slate-400"
    : "bg-red-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function bytesHuman(bytes?: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

export default function AdminOverviewPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("zh") ? "zh" : "en";
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [kb, setKb] = useState<KnowledgeBaseConfig | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumPayload | null>(null);
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [sysRes, kbRes, curRes, graphRes] = await Promise.all([
        fetch(apiUrl("/api/v1/system/status"), { cache: "no-store" }),
        fetch(apiUrl("/api/v1/knowledge/configs"), { cache: "no-store" }),
        fetch(apiUrl("/api/v1/antitao-curriculum"), { cache: "no-store" }),
        fetch(apiUrl("/api/v1/knowledge-graph"), { cache: "no-store" }),
      ]);
      setSystem(await sysRes.json());
      setKb(await kbRes.json());
      setCurriculum(await curRes.json());
      setGraph(await graphRes.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const kbList = kb?.knowledge_bases ? Object.entries(kb.knowledge_bases) : [];
  const tracks = curriculum?.curriculum?.tracks || [];
  const graphTracks = graph?.graph?.tracks || [];
  const graphNodes = graph?.graph?.nodes || [];

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {t("admin.overview.eyebrow")}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
            {t("admin.overview.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("admin.overview.subtitle")}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-2 text-sm font-medium hover:bg-[var(--secondary)]/50 disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("admin.overview.refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 系统状态 */}
        <Card
          icon={<Cpu className="h-5 w-5" />}
          title={t("admin.overview.systemTitle")}
          href="/admin/system"
          hrefLabel={t("admin.overview.systemDetail")}
        >
          {system ? (
            <ul className="space-y-2 text-sm">
              <Row
                label={t("admin.overview.backendLabel")}
                value={system.backend.status}
                status={system.backend.status}
              />
              <Row
                label={t("admin.overview.llmLabel")}
                value={system.llm.model || "—"}
                status={system.llm.status}
                hint={system.llm.status}
              />
              <Row
                label={t("admin.overview.embedLabel")}
                value={system.embeddings.model || "—"}
                status={system.embeddings.status}
                hint={system.embeddings.status}
              />
              <Row
                label={t("admin.overview.searchLabel")}
                value={system.search.provider || t("admin.overview.notConfigured")}
                status={system.search.status}
                hint={system.search.status}
              />
            </ul>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">
              {t("admin.overview.loading")}
            </div>
          )}
        </Card>

        {/* 知识库 */}
        <Card
          icon={<Database className="h-5 w-5" />}
          title={t("admin.overview.kbTitle")}
          href="/admin/knowledge-bases"
          hrefLabel={t("admin.overview.kbManage")}
        >
          {kbList.length ? (
            <ul className="space-y-2 text-sm">
              {kbList.map(([name, info]) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[var(--secondary)]/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{name}</div>
                    <div className="truncate text-xs text-[var(--muted-foreground)]">
                      {info.document_count ?? 0} {t("admin.overview.kbDocs")} ·{" "}
                      {bytesHuman(info.total_size_bytes)} ·{" "}
                      {info.rag_provider || "—"}
                    </div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">
              {t("admin.overview.kbEmpty")}
            </div>
          )}
        </Card>

        {/* 知识图谱 */}
        <Card
          icon={<Network className="h-5 w-5" />}
          title={t("admin.overview.graphTitle")}
          href="/admin/knowledge-graph"
          hrefLabel={t("admin.overview.graphEdit")}
        >
          {graph ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[var(--secondary)]/30 px-3 py-3">
                  <div className="text-2xl font-semibold">{graphNodes.length}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {t("admin.overview.graphNodes")}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--secondary)]/30 px-3 py-3">
                  <div className="text-2xl font-semibold">{graphTracks.length}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {t("admin.overview.graphTracks")}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {graphTracks.map((track) => (
                  <span
                    key={track.id}
                    className="rounded-full border border-[var(--border)]/60 px-2 py-1 text-xs text-[var(--muted-foreground)]"
                  >
                    {track.label?.[locale as "zh" | "en"] || track.id}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">
              {t("admin.overview.loading")}
            </div>
          )}
        </Card>

        {/* 课程 */}
        <Card
          icon={<GraduationCap className="h-5 w-5" />}
          title={t("admin.overview.curriculumTitle")}
          href="/curriculum"
          hrefLabel={t("admin.overview.curriculumEdit")}
        >
          {tracks.length ? (
            <ul className="space-y-2 text-sm">
              {tracks.map((track) => (
                <li
                  key={track.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[var(--secondary)]/30 px-3 py-2"
                >
                  <div>
                    <div className="font-medium">
                      {track.badge?.[locale as "zh" | "en"] || track.id}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {track.gates.length} {t("admin.overview.gateUnit")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">
              {t("admin.overview.curriculumEmpty")}
            </div>
          )}
        </Card>

        {/* 会员 */}
        <Card
          icon={<Users className="h-5 w-5" />}
          title={t("admin.overview.membersTitle")}
          href="/admin/members"
          hrefLabel={t("admin.overview.membersManage")}
        >
          <div className="rounded-xl border border-dashed border-[var(--border)]/60 bg-[var(--secondary)]/20 p-4 text-center">
            <div className="text-2xl">🚧</div>
            <div className="mt-2 text-sm font-medium">
              {t("admin.overview.membersComingSoon")}
            </div>
            <div className="mt-1 text-xs text-[var(--muted-foreground)]">
              {t("admin.overview.membersComingSoonHint")}
            </div>
          </div>
        </Card>
      </div>

      {/* 快捷链接说明 */}
      <div className="mt-6 rounded-2xl border border-[var(--border)]/40 bg-[var(--secondary)]/20 p-4 text-xs text-[var(--muted-foreground)]">
        💡 {t("admin.overview.tip")}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  href,
  hrefLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--foreground)]">
          {icon}
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        {href && hrefLabel && (
          <Link
            href={href}
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            {hrefLabel} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  status,
  hint,
}: {
  label: string;
  value: string;
  status: string;
  hint?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-[var(--secondary)]/30 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={status} />
        <span className="text-[var(--muted-foreground)]">{label}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate font-medium">{value}</span>
        {hint && hint !== "configured" && hint !== "online" && (
          <span className="rounded-md bg-[var(--background)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--muted-foreground)]">
            {hint}
          </span>
        )}
      </div>
    </li>
  );
}
