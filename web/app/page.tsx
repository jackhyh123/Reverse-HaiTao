import Link from "next/link";
import { ArrowRight, Bot, Compass, GraduationCap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white via-slate-50 to-slate-100 px-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-2xl text-center">
        {/* Brand */}
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
          反淘淘金通关系统
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          反向海淘行业的导航与学习平台——看清生态、找准位置、做出行动
        </p>

        {/* Three modules */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <ModuleCard
            icon={<Compass className="h-6 w-6" />}
            color="amber"
            title="生态图谱"
            desc="看清反淘行业全貌，找到你的角色位置和行动路径"
          />
          <ModuleCard
            icon={<GraduationCap className="h-6 w-6" />}
            color="blue"
            title="学习中心"
            desc="按知识图谱系统学习，从概念到实操逐步通关"
          />
          <ModuleCard
            icon={<Bot className="h-6 w-6" />}
            color="emerald"
            title="AI 导师"
            desc="随时向 AI 提问，获得个性化的行业指导和行动建议"
          />
        </div>

        {/* How to use */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            怎么用这个网站
          </h2>
          <div className="mt-4 space-y-3">
            <StepRow num={1} title="进入生态图谱" desc="选择你的身份（买家/卖家/平台），沿着买家旅程看清每个阶段的关键渠道和角色协作关系。" />
            <StepRow num={2} title="找到你的行动路径" desc="根据你的角色，图谱会展示每个阶段你该做什么——买家看渠道，卖家和平台看具体动作。" />
            <StepRow num={3} title="进入学习中心深度学习" desc="有了方向后，去学习中心按知识图谱系统掌握反淘核心概念和实操技能。" />
            <StepRow num={4} title="随时问 AI 导师" desc="底部悬浮的 AI 导师按钮随时可用，问任何关于反淘行业的问题。" />
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/explore"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-[15px] font-bold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl active:scale-[0.98] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 sm:w-auto"
          >
            进入生态图谱
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/learn"
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-6 py-3 text-[15px] font-medium text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200 sm:w-auto"
          >
            已有方向，直接学习
          </Link>
        </div>

        <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">
          反向海淘 = 海外买家通过中国电商平台 + 代理服务购买中国商品
        </p>
      </div>
    </div>
  );
}

function ModuleCard({
  icon,
  color,
  title,
  desc,
}: {
  icon: React.ReactNode;
  color: "amber" | "blue" | "emerald";
  title: string;
  desc: string;
}) {
  const colors = {
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color]}`}>
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 dark:bg-black/20">
        {icon}
      </div>
      <div className="text-sm font-bold">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed opacity-75">{desc}</div>
    </div>
  );
}

function StepRow({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        {num}
      </span>
      <div>
        <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </div>
        <div className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          {desc}
        </div>
      </div>
    </div>
  );
}
