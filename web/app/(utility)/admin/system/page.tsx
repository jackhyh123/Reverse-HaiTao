"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "@/lib/api";

interface TestResult {
  success: boolean;
  message: string;
  model?: string | null;
  response_time_ms?: number | null;
  error?: string | null;
}

export default function AdminSystemPage() {
  const { t } = useTranslation();
  const [topology, setTopology] = useState<unknown>(null);
  const [llmTest, setLlmTest] = useState<TestResult | null>(null);
  const [embedTest, setEmbedTest] = useState<TestResult | null>(null);
  const [running, setRunning] = useState<string>("");

  const loadTopology = async () => {
    try {
      const r = await fetch(apiUrl("/api/v1/system/runtime-topology"), {
        cache: "no-store",
      });
      setTopology(await r.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void loadTopology();
  }, []);

  const runTest = async (kind: "llm" | "embed") => {
    setRunning(kind);
    try {
      const path = kind === "llm" ? "/api/v1/system/test/llm" : "/api/v1/system/test/embeddings";
      const r = await fetch(apiUrl(path), { method: "POST" });
      const data = (await r.json()) as TestResult;
      if (kind === "llm") setLlmTest(data);
      else setEmbedTest(data);
    } catch (e) {
      const result: TestResult = {
        success: false,
        message: String(e),
        error: String(e),
      };
      if (kind === "llm") setLlmTest(result);
      else setEmbedTest(result);
    } finally {
      setRunning("");
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
          {t("admin.system.eyebrow")}
        </div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
          {t("admin.system.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {t("admin.system.subtitle")}
        </p>
      </div>

      {/* 连接测试 */}
      <div className="grid gap-4 md:grid-cols-2">
        <TestCard
          title={t("admin.system.testLLM")}
          description={t("admin.system.testLLMDesc")}
          result={llmTest}
          loading={running === "llm"}
          onRun={() => runTest("llm")}
        />
        <TestCard
          title={t("admin.system.testEmbed")}
          description={t("admin.system.testEmbedDesc")}
          result={embedTest}
          loading={running === "embed"}
          onRun={() => runTest("embed")}
        />
      </div>

      {/* 运行时拓扑 */}
      <div className="mt-6 rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{t("admin.system.topology")}</h3>
          <button
            onClick={loadTopology}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)]/60 px-3 py-1.5 text-xs hover:bg-[var(--secondary)]/40"
          >
            <RefreshCcw className="h-3 w-3" />
            {t("admin.system.refresh")}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-[var(--secondary)]/40 p-4 text-xs">
          {topology ? JSON.stringify(topology, null, 2) : t("admin.system.loading")}
        </pre>
      </div>
    </div>
  );
}

function TestCard({
  title,
  description,
  result,
  loading,
  onRun,
}: {
  title: string;
  description: string;
  result: TestResult | null;
  loading: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Zap className="h-4 w-4 text-[var(--primary)]" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
      <button
        onClick={onRun}
        disabled={loading}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "…" : "Run"}
      </button>
      {result && (
        <div
          className={`mt-3 rounded-xl px-3 py-2 text-xs ${
            result.success
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
          }`}
        >
          <div className="font-medium">
            {result.success ? "✓" : "✗"} {result.message}
          </div>
          {result.model && <div className="opacity-80">model: {result.model}</div>}
          {result.response_time_ms != null && (
            <div className="opacity-80">{result.response_time_ms.toFixed(0)} ms</div>
          )}
          {result.error && <div className="opacity-80">{result.error}</div>}
        </div>
      )}
    </div>
  );
}
