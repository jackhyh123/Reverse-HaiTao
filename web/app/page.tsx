import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Compass,
  Database,
  Globe,
  GraduationCap,
  MessageCircle,
  ShoppingCart,
  Sparkles,
  Target,
  Truck,
  Zap,
} from "lucide-react";
import { REGIONS, type RegionId } from "@/lib/ecosystem";

// ─── Region icon resolver ────────────────────────────────────────

function regionIcon(iconName: string) {
  const map: Record<string, React.ReactNode> = {
    Globe: <Globe className="h-4 w-4" />,
    ShoppingCart: <ShoppingCart className="h-4 w-4" />,
    Truck: <Truck className="h-4 w-4" />,
    Database: <Database className="h-4 w-4" />,
  };
  return map[iconName] ?? <Database className="h-4 w-4" />;
}

// ─── Page ─────────────────────────────────────────────────────────

export default function HomePage() {
  const regionOrder: RegionId[] = [
    "traffic",
    "transaction",
    "fulfillment",
    "infrastructure",
  ];

  return (
    <div
      className="relative flex min-h-screen flex-col items-center px-4 py-16 sm:py-20"
      style={{
        background: "var(--background)",
        backgroundImage:
          "radial-gradient(ellipse at 50% 0%, rgba(176,80,30,0.05) 0%, transparent 55%)",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="w-full max-w-2xl">
        {/* ═══════════ HERO + CTA ═══════════ */}
        <section className="text-center">
          <div
            className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), rgba(176,80,30,0.5))",
              boxShadow: "0 4px 20px rgba(176,80,30,0.25)",
              animation: "clay-float 3s ease-in-out infinite",
            }}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>

          <h1
            className="font-sans text-3xl font-black tracking-tight sm:text-4xl"
            style={{ color: "var(--foreground)" }}
          >
            反淘淘金通关系统
          </h1>
          <p
            className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            反向海淘行业的导航与学习平台——看清生态、找准位置、做出行动
          </p>

          {/* CTA Buttons — 紧贴 Hero，第一眼就能行动 */}
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/explore"
              className="clay-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-[15px] font-bold sm:w-auto"
            >
              进入生态图谱
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/learn"
              className="clay-btn inline-flex w-full items-center justify-center gap-1 rounded-xl px-6 py-3 text-[15px] font-semibold sm:w-auto"
              style={{ color: "var(--muted-foreground)" }}
            >
              已有方向，直接学习
            </Link>
          </div>
        </section>

        {/* ═══════════ MODULE CARDS ═══════════ */}
        <section className="mt-10">
          <h2
            className="mb-4 text-center text-[13px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            核心功能
          </h2>
          <div className="space-y-4">
          {/* ── 生态图谱 ── */}
          <Link href="/explore" className="group block">
            <div className="clay-card relative overflow-hidden p-5 transition-all duration-200 sm:p-6">
              <div className="absolute left-0 top-0 h-full w-1"
                style={{ backgroundColor: "#f59e0b" }} />
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "#f59e0b15", color: "#f59e0b" }}>
                  <Compass className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-bold"
                    style={{ color: "var(--foreground)" }}>
                    生态图谱
                  </h3>
                  <p className="mt-0.5 text-[13px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}>
                    看清反淘行业全貌，找到你的角色位置和行动路径
                  </p>
                  {/* Feature chips — 4 ecosystem layers */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {regionOrder.map((rid) => {
                      const r = REGIONS[rid];
                      return (
                        <span key={rid}
                          className="clay-chip inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                          style={{ color: "var(--muted-foreground)" }}>
                          <span style={{ color: r.color }}>{regionIcon(r.icon)}</span>
                          {r.label.zh}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="hidden shrink-0 items-center self-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:flex">
                  <ArrowRight className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </div>
              </div>
            </div>
          </Link>

          {/* ── 学习中心 ── */}
          <Link href="/learn" className="group block">
            <div className="clay-card relative overflow-hidden p-5 transition-all duration-200 sm:p-6">
              <div className="absolute left-0 top-0 h-full w-1"
                style={{ backgroundColor: "#3b82f6" }} />
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "#3b82f615", color: "#3b82f6" }}>
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-bold"
                    style={{ color: "var(--foreground)" }}>
                    学习中心
                  </h3>
                  <p className="mt-0.5 text-[13px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}>
                    按知识图谱系统学习，从概念到实操逐步通关
                  </p>
                  {/* Feature list */}
                  <ul className="mt-3 space-y-1.5">
                    <FeatureItem icon={<Target className="h-3.5 w-3.5" />}
                      text="AI 诊断，生成个性化学习路线" />
                    <FeatureItem icon={<BarChart3 className="h-3.5 w-3.5" />}
                      text="知识图谱系统学习核心概念" />
                    <FeatureItem icon={<Zap className="h-3.5 w-3.5" />}
                      text="从概念到实操，逐步通关验证" />
                  </ul>
                </div>
                <div className="hidden shrink-0 items-center self-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:flex">
                  <ArrowRight className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </div>
              </div>
            </div>
          </Link>

          {/* ── AI 导师 ── */}
          <Link href="/explore" className="group block">
            <div className="clay-card relative overflow-hidden p-5 transition-all duration-200 sm:p-6">
              <div className="absolute left-0 top-0 h-full w-1"
                style={{ backgroundColor: "#10b981" }} />
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "#10b98115", color: "#10b981" }}>
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-bold"
                    style={{ color: "var(--foreground)" }}>
                    AI 导师
                  </h3>
                  <p className="mt-0.5 text-[13px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}>
                    随时向 AI 提问，获得个性化的行业指导和行动建议
                  </p>
                  {/* Feature list */}
                  <ul className="mt-3 space-y-1.5">
                    <FeatureItem icon={<MessageCircle className="h-3.5 w-3.5" />}
                      text="随时随地提问，即问即答" />
                    <FeatureItem icon={<Sparkles className="h-3.5 w-3.5" />}
                      text="基于深度知识库的专业解答" />
                    <FeatureItem icon={<Target className="h-3.5 w-3.5" />}
                      text="结合学习进度的个性化指导" />
                  </ul>
                </div>
                <div className="hidden shrink-0 items-center self-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:flex">
                  <ArrowRight className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </div>
              </div>
            </div>
          </Link>
          </div>
        </section>

        {/* ═══════════ FOOTER ═══════════ */}
        <p
          className="mt-8 pb-8 text-center text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          反向海淘 = 海外买家通过中国电商平台 + 代理服务购买中国商品
        </p>
      </div>
    </div>
  );
}

// ─── Tiny helper ──────────────────────────────────────────────────

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2 text-[12px] leading-relaxed"
      style={{ color: "var(--muted-foreground)" }}>
      <span className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }}>
        {icon}
      </span>
      {text}
    </li>
  );
}
