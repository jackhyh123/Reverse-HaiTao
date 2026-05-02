"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import FloatingAITutor from "@/components/learn/FloatingAITutor";
import { DEFAULT_EXPLORE_GRAPH } from "@/lib/explore-graph";

type LocaleKey = "zh" | "en";

// ═══════════════════════════════════════════════════════════════
// Journey Stages
// ═══════════════════════════════════════════════════════════════

const JOURNEY_STAGES = [
  { id: "discovery", number: 1, label: { zh: "① 发现", en: "① Discovery" }, question: { zh: "用户在哪看到产品", en: "Where do buyers discover?" }, color: "#f59e0b" },
  { id: "verification", number: 2, label: { zh: "② 验证", en: "② Verification" }, question: { zh: "怎么判断靠不靠谱", en: "How to verify trust?" }, color: "#f97316" },
  { id: "decision", number: 3, label: { zh: "③ 决策", en: "③ Decision" }, question: { zh: "怎么下决心购买", en: "How to decide?" }, color: "#ef4444" },
  { id: "purchase", number: 4, label: { zh: "④ 购买", en: "④ Purchase" }, question: { zh: "在哪下单付款", en: "Where to purchase?" }, color: "#3b82f6" },
  { id: "delivery", number: 5, label: { zh: "⑤ 收货", en: "⑤ Delivery" }, question: { zh: "商品怎么到手", en: "How does it arrive?" }, color: "#10b981" },
  { id: "sharing", number: 6, label: { zh: "⑥ 分享", en: "⑥ Sharing" }, question: { zh: "怎么晒单形成口碑", en: "How to share & review?" }, color: "#8b5cf6" },
];

// ═══════════════════════════════════════════════════════════════
// Role-specific stage content
// ═══════════════════════════════════════════════════════════════

interface StageCard {
  title: string;
  description: string;
  /** For buyer: which channel/platform/tool */
  source?: string;
  /** For seller/platform: suggested action verb */
  action?: string;
}

interface StageContent {
  /** What happens at this stage for this role */
  summary: string;
  /** Key cards shown at this stage */
  cards: StageCard[];
  /** Connected to the next stage (continuity) */
  nextHint?: string;
}

const BUYER_CONTENT: Record<string, StageContent> = {
  discovery: {
    summary: "买家刷到种草内容，第一次发现产品",
    cards: [
      { title: "KOL / 达人内容", description: "TikTok、YouTube、小红书上达人发布种草视频和图文，解决「发现」和「初步信任」", source: "TikTok · YouTube · 小红书" },
      { title: "平台算法推荐", description: "TikTok Shop、淘宝的推荐算法把商品推给可能感兴趣的用户", source: "TikTok Shop · 淘宝" },
      { title: "独立社区讨论", description: "Reddit 社区（如 r/RepFashion）里用户自发的推荐和避坑帖", source: "Reddit" },
    ],
    nextHint: "被勾起兴趣后，买家会去验证",
  },
  verification: {
    summary: "买家不信任广告，主动搜索验证产品和卖家",
    cards: [
      { title: "Reddit 社区验证", description: "在 r/RepFashion 等社区搜索卖家名字 + review，看真实买家反馈。版主和资深用户帮你判断靠不靠谱", source: "Reddit · r/RepFashion" },
      { title: "Yupoo 相册看 QC 图", description: "卖家在 Yupoo 上传质检实拍图，买家逐张检查细节、走线、标牌", source: "Yupoo" },
      { title: "Discord 私域深聊", description: "加入 Discord 服务器，直接问买过的人尺码、质量、物流体验", source: "Discord" },
    ],
    nextHint: "验证通过后，开始下决心",
  },
  decision: {
    summary: "买家在私域社区深度交流后下决心购买",
    cards: [
      { title: "Discord / Telegram 群聊", description: "在私域群里直接问 KOL 和买过的人：尺码偏不偏、质量怎么样、物流要多久", source: "Discord · Telegram" },
      { title: "KOL 专属链接", description: "达人在直播或视频里放专属链接/折扣码，直接推动购买决策", source: "TikTok · Instagram" },
      { title: "比价和选物流", description: "在不同代理平台之间对比价格、物流时效、服务费", source: "Pandabuy · Superbuy · Wegobuy" },
    ],
    nextHint: "下定决心后，去下单",
  },
  purchase: {
    summary: "买家在代理平台下单付款",
    cards: [
      { title: "代理平台代购", description: "在 Pandabuy、Superbuy、Wegobuy 粘贴商品链接，平台帮你从淘宝/1688下单", source: "Pandabuy · Superbuy · Wegobuy" },
      { title: "选择增值服务", description: "勾选 QC 拍照验货、真空包装、加固包装等增值服务", source: "代理平台内置服务" },
      { title: "跨境支付", description: "通过 Stripe、PayPal、Alipay+ 完成跨境付款", source: "Stripe · PayPal · Alipay+" },
    ],
    nextHint: "付款后进入履约环节",
  },
  delivery: {
    summary: "商品经过仓库、质检、集运送到买家手中",
    cards: [
      { title: "仓库收货验货", description: "国内仓库收到商品后拍照验货，买家在线确认 QC 照片", source: "仓库 QC 服务" },
      { title: "合包集运", description: "多个订单合并打包，减少国际运费", source: "代理平台集运" },
      { title: "国际物流 + 清关", description: "通过 EMS、DHL、专线等发往海外，清关后派送到手", source: "EMS · DHL · 专线物流" },
    ],
    nextHint: "收到货后，买家会去晒单",
  },
  sharing: {
    summary: "买家晒单分享，形成口碑回流到发现阶段",
    cards: [
      { title: "Reddit 晒单帖", description: "在 r/RepFashion 发开箱帖、穿搭建议、评分，成为社区贡献者", source: "Reddit" },
      { title: "Discord 反馈", description: "在 Discord 群里发上身图和体验，直接影响群友的购买决策", source: "Discord" },
      { title: "成为 KOC", description: "持续高质量分享 → 积累信誉 → 成为关键意见消费者，甚至开始接合作", source: "Reddit · Discord" },
    ],
    nextHint: "口碑回流到发现阶段，形成流量闭环 🔄",
  },
};

const PLATFORM_CONTENT: Record<string, StageContent> = {
  discovery: {
    summary: "平台需要出现在买家发现产品的渠道中",
    cards: [
      { title: "签约 KOL 推广", description: "找到匹配的达人洽谈合作：寄样 → 签约 → 专属链接 → 佣金分成", action: "找 KOL 洽谈合作" },
      { title: "SEO 和内容布局", description: "在 Reddit、YouTube 布局品牌关键词，让买家搜索时能找到你", action: "布局 SEO 内容" },
      { title: "算法投放", description: "在 TikTok、淘宝投放信息流广告，精准触达目标买家", action: "投放精准广告" },
    ],
  },
  verification: {
    summary: "平台需要在验证渠道建立信任",
    cards: [
      { title: "Reddit 口碑管理", description: "监控 r/RepFashion 等社区对平台的讨论，及时回应差评，鼓励好评", action: "管理社区口碑" },
      { title: "QC 服务标准化", description: "建立标准化的 QC 拍照流程，让买家的验证体验一致可靠", action: "标准化 QC 流程" },
      { title: "透明化展示", description: "在平台展示卖家评分、交易量、退货率等指标，降低买家的验证成本", action: "展示卖家信用指标" },
    ],
  },
  decision: {
    summary: "平台需要在决策环节降低摩擦",
    cards: [
      { title: "嵌入 Discord 生态", description: "在主流 Discord 服务器建立官方频道，让买家直接咨询", action: "建立 Discord 官方频道" },
      { title: "KOL 直播带货", description: "与 KOL 合作在 TikTok/Instagram 直播，实时展示商品并完成成交", action: "合作 KOL 直播" },
      { title: "比价工具优化", description: "提供清晰的价格对比、物流时效估算，帮助买家快速决策", action: "优化比价体验" },
    ],
  },
  purchase: {
    summary: "平台的核心战场——优化下单到支付的全链路",
    cards: [
      { title: "接入国内电商 API", description: "对接 1688、淘宝开放平台、拼多多 API，自动同步商品和价格", action: "对接电商 API" },
      { title: "支付链路优化", description: "接入 Stripe、PayPal 等跨境支付，支持多币种结算", action: "接入跨境支付" },
      { title: "用户体验打磨", description: "优化移动端下单流程、商品搜索、购物车体验", action: "优化下单体验" },
    ],
  },
  delivery: {
    summary: "平台需要让履约可追踪、可信任",
    cards: [
      { title: "仓库 + 集运系统", description: "自建或合作国内仓库，建立收货→QC→合包→发出的标准流水线", action: "建立仓储物流体系" },
      { title: "物流追踪透明化", description: "买家实时看到物流节点：已入库→已QC→已合包→已发出→清关中→派送中", action: "物流追踪系统" },
      { title: "清关合规", description: "处理各国关税、增值税申报，避免包裹被扣", action: "处理清关合规" },
    ],
  },
  sharing: {
    summary: "平台需要激励买家分享，形成增长飞轮",
    cards: [
      { title: "晒单激励机制", description: "买家晒单返现、积分、优惠券，主动驱动口碑内容生产", action: "建立晒单激励" },
      { title: "社区运营", description: "在 Reddit、Discord 培养品牌倡导者，让满意的买家帮你拉新", action: "培养品牌倡导者" },
      { title: "数据闭环", description: "追踪「哪个 KOL → 多少点击 → 多少下单 → 多少晒单」的完整漏斗", action: "追踪增长漏斗" },
    ],
  },
};

const SELLER_CONTENT: Record<string, StageContent> = {
  discovery: {
    summary: "卖家需要让自己的产品出现在买家发现渠道中",
    cards: [
      { title: "找到匹配的 KOL 合作", description: "根据产品品类找到风格匹配的达人 → 私信洽谈 → 寄样 → 谈佣金", action: "找 KOL 寄样合作" },
      { title: "在 Reddit 建立存在感", description: "主动在 r/RepFashion 等社区回答买家问题，建立信誉后再推广产品", action: "Reddit 社区运营" },
      { title: "优化商品主图和描述", description: "1688/淘宝的商品图可能不够好，自己拍高质量的白底图和上身图", action: "优化商品展示" },
    ],
  },
  verification: {
    summary: "卖家需要让买家能验证你的产品",
    cards: [
      { title: "建立 Yupoo 相册", description: "上传高清 QC 实拍图到 Yupoo，按商品分类，方便买家查看细节", action: "建立 Yupoo 相册" },
      { title: "积累 Reddit 好评", description: "每成交一单请买家在 Reddit 写 review，积累可搜索的信誉资产", action: "积累社区好评" },
      { title: "提供 QC 服务", description: "发货前主动拍照发给买家确认，减少退货纠纷", action: "主动提供 QC 图" },
    ],
  },
  decision: {
    summary: "卖家需要在买家决策时提供推力",
    cards: [
      { title: "在 Discord 建立信任", description: "加入买家活跃的 Discord 服务器，真诚回答问题（不硬广），建立个人信誉", action: "Discord 社区参与" },
      { title: "限时优惠推动决策", description: "给 KOL 的粉丝提供专属折扣码，制造紧迫感", action: "设置 KOL 专属折扣" },
      { title: "提供尺码建议", description: "整理详细的尺码对照表和推荐建议，减少买家犹豫", action: "整理尺码指南" },
    ],
  },
  purchase: {
    summary: "卖家需要在购买环节让交易顺畅",
    cards: [
      { title: "在代理平台铺货", description: "将商品信息同步到 Pandabuy、Superbuy 等平台，让买家可以直接下单", action: "平台铺货上架" },
      { title: "对接 1688/淘宝", description: "确保商品在 1688 或淘宝的链接有效、库存准确、价格更新", action: "维护货源链接" },
      { title: "处理定制需求", description: "买家可能有特殊尺码或定制需求，建立快速响应机制", action: "响应定制需求" },
    ],
  },
  delivery: {
    summary: "卖家需要保证商品准时完好到达买家手中",
    cards: [
      { title: "发货到合作仓库", description: "将商品发到代理平台指定的国内仓库，确保包装完好", action: "发货到仓库" },
      { title: "配合 QC 流程", description: "如果仓库 QC 发现问题，及时换货或与买家沟通", action: "配合 QC 换货" },
      { title: "选择可靠物流", description: "根据目的地推荐最合适的物流方案（EMS/DHL/专线）", action: "推荐物流方案" },
    ],
  },
  sharing: {
    summary: "卖家需要让满意的买家帮你传播",
    cards: [
      { title: "请求买家晒单", description: "买家收货后主动跟进，礼貌请求在 Reddit/Discord 分享体验", action: "跟进请求晒单" },
      { title: "返现激励好评", description: "给予晒单买家小额返现或下次折扣，形成正向循环", action: "晒单返现激励" },
      { title: "建立复购关系", description: "通过 Discord/微信维护老客户关系，新品推送、老客折扣", action: "维护老客复购" },
    ],
  },
};

const ROLE_META: Record<string, { label: { zh: string; en: string }; color: string; icon: string }> = {
  buyer:    { label: { zh: "买家视角", en: "Buyer" }, color: "#10b981", icon: "🧑‍💻" },
  platform: { label: { zh: "平台视角", en: "Platform" }, color: "#3b82f6", icon: "🏪" },
  seller:   { label: { zh: "卖家视角", en: "Seller" }, color: "#f59e0b", icon: "📦" },
};

function getContent(role: string): Record<string, StageContent> {
  if (role === "platform") return PLATFORM_CONTENT;
  if (role === "seller") return SELLER_CONTENT;
  return BUYER_CONTENT;
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ActionStep {
  title: string;
  description: string;
  resource_url?: string;
}

interface AiFocusState {
  highlightedNodes: string[];
  actionSteps: ActionStep[];
  completedSteps: Set<number>;
}

// ═══════════════════════════════════════════════════════════════
// Quick questions (role-aware)
// ═══════════════════════════════════════════════════════════════

const QUICK_QUESTIONS: Record<string, string[]> = {
  buyer: [
    "第一次买反淘，应该从哪个平台开始？",
    "怎么在 Reddit 上判断一个卖家靠不靠谱？",
    "Pandabuy 和 Superbuy 哪个更好用？",
  ],
  platform: [
    "怎么找到愿意合作的 KOL？",
    "跨境支付接入 Stripe 还是 PayPal？",
    "仓库和物流怎么搭建？",
  ],
  seller: [
    "怎么找到匹配的 KOL 寄样合作？",
    "怎么在 Reddit 上积累第一批好评？",
    "1688 和淘宝货源有什么区别？",
  ],
};

// ═══════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════

export default function ExplorePage() {
  const locale: LocaleKey = "zh";
  const { domains, nodes: graphNodes } = DEFAULT_EXPLORE_GRAPH;

  const [selectedRole, setSelectedRole] = useState<string>("buyer");
  const [aiFocusState, setAiFocusState] = useState<AiFocusState | null>(null);

  const inAiFocus = aiFocusState !== null;
  const roleMeta = ROLE_META[selectedRole];
  const content = useMemo(() => getContent(selectedRole), [selectedRole]);

  // Graph context for API
  const graphContext = useMemo(
    () => ({
      domains: domains.map((d) => ({ id: d.id, label: d.label, summary: d.summary, color: d.color })),
      nodes: graphNodes.map((n) => ({
        id: n.id, domain: n.domain, title: n.title, summary: n.summary,
        tags: n.tags, connections: n.connections,
      })),
    }),
    [domains, graphNodes],
  );

  // AI response handler
  const handleAIResponse = useCallback((data: Record<string, unknown>) => {
    const highlightedNodes = data.highlighted_nodes as string[] | undefined;
    const actionSteps = data.action_steps as ActionStep[] | undefined;
    if (highlightedNodes && highlightedNodes.length > 0) {
      setAiFocusState({
        highlightedNodes,
        actionSteps: actionSteps || [],
        completedSteps: new Set(),
      });
    }
  }, []);

  const exitAiFocus = useCallback(() => setAiFocusState(null), []);

  const toggleStepComplete = useCallback((index: number) => {
    setAiFocusState((prev) => {
      if (!prev) return null;
      const next = new Set(prev.completedSteps);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...prev, completedSteps: next };
    });
  }, []);

  const focusBannerText = useMemo(() => {
    if (!aiFocusState) return "";
    const names = aiFocusState.highlightedNodes
      .slice(0, 3)
      .map((id) => graphNodes.find((n) => n.id === id)?.title[locale] || id)
      .join(" · ");
    return `已为你聚焦"${names}"相关路径`;
  }, [aiFocusState, graphNodes, locale]);

  // ═════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-slate-200/60 bg-white/80 px-4 py-2.5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              反淘生态图谱
            </h1>
            <span className="hidden text-[11px] text-slate-500 md:inline dark:text-slate-400">
              选择你的身份，查看专属旅程和行动建议
            </span>
          </div>
          <div className="flex items-center gap-2">
            {inAiFocus && (
              <button
                onClick={exitAiFocus}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                查看全景
              </button>
            )}
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800">
              我的路径
            </button>
          </div>
        </div>

        {/* ── Role selector ── */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            我是
          </span>
          {Object.entries(ROLE_META).map(([id, meta]) => (
            <button
              key={id}
              onClick={() => { setSelectedRole(id); exitAiFocus(); }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                selectedRole === id
                  ? "text-white shadow"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
              style={selectedRole === id ? { backgroundColor: meta.color } : {}}
            >
              <span className="text-xs">{meta.icon}</span>
              {meta.label[locale]}
            </button>
          ))}
        </div>
      </div>

      {/* ── AI Focus banner ── */}
      {inAiFocus && (
        <div className="shrink-0 border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 backdrop-blur dark:border-amber-800/30 dark:bg-amber-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-amber-600 dark:text-amber-400">⚡</span>
              <span className="font-medium text-amber-900 dark:text-amber-200">{focusBannerText}</span>
              <button onClick={exitAiFocus} className="ml-2 text-xs font-medium text-amber-600 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300">
                查看全景
              </button>
            </div>
            <button onClick={exitAiFocus} className="rounded-lg p-1 text-amber-500 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-auto" style={inAiFocus ? { marginRight: 340 } : undefined}>
          {/* ── Stage header ── */}
          <div className="sticky top-0 z-10 grid grid-cols-6 border-b border-slate-200/60 bg-white/95 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/95">
            {JOURNEY_STAGES.map((stage) => (
              <div
                key={stage.id}
                className="flex flex-col items-center gap-0.5 border-l border-slate-100 px-2 py-3 first:border-l-0 dark:border-slate-800"
              >
                <div className="text-[13px] font-bold" style={{ color: stage.color }}>
                  {stage.label[locale]}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {stage.question[locale]}
                </div>
              </div>
            ))}
          </div>

          {/* ── Stage cards ── */}
          <div className="grid grid-cols-6">
            {JOURNEY_STAGES.map((stage) => {
              const stageContent = content[stage.id];
              const cards = stageContent?.cards || [];
              return (
                <div
                  key={stage.id}
                  className="border-l border-slate-100 p-3 first:border-l-0 dark:border-slate-800"
                >
                  {/* Summary */}
                  <div className="mb-3 rounded-lg px-2.5 py-2 text-center text-[11px] font-medium leading-relaxed"
                    style={{
                      backgroundColor: `${stage.color}10`,
                      color: stage.color,
                    }}
                  >
                    {stageContent?.summary || "—"}
                  </div>

                  {/* Cards */}
                  <div className="space-y-2.5">
                    {cards.map((card, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                      >
                        <div
                          className="text-[12px] font-bold leading-tight text-slate-800 dark:text-slate-200"
                          style={{ color: selectedRole === "buyer" ? undefined : roleMeta.color }}
                        >
                          {card.title}
                        </div>
                        <div className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {card.description}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {card.source && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {card.source}
                            </span>
                          )}
                          {card.action && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
                              style={{ backgroundColor: roleMeta.color }}
                            >
                              {card.action} <ChevronRight className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Next hint */}
                  {stageContent?.nextHint && (
                    <div className="mt-3 text-center text-[10px] italic text-slate-300 dark:text-slate-600">
                      ↓ {stageContent.nextHint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Footer hint ── */}
          <div className="px-4 py-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              💡 切换上方身份查看不同角色的旅程和行动建议 · 底部 AI 导师按需规划个性化路径
            </span>
          </div>
        </div>

        {/* ── Action steps panel (AI focus) ── */}
        {inAiFocus && aiFocusState.actionSteps.length > 0 && (
          <div className="absolute right-0 top-0 z-20 flex h-full w-[340px] flex-col border-l border-slate-200/60 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/95">
            <div className="shrink-0 border-b border-slate-200/40 px-4 py-3 dark:border-slate-800/40">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">你的行动路径</div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {aiFocusState.completedSteps.size} / {aiFocusState.actionSteps.length} 步已完成
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-3">
                {aiFocusState.actionSteps.map((step, i) => {
                  const done = aiFocusState.completedSteps.has(i);
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 transition-all ${
                        done
                          ? "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/30"
                          : "border-slate-200/60 bg-white dark:border-slate-800/60 dark:bg-slate-900/50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => toggleStepComplete(i)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300 hover:border-slate-400 dark:border-slate-600"
                          }`}
                        >
                          {done && <Check className="h-3 w-3" />}
                        </button>
                        <div className="min-w-0">
                          <div className={`text-[13px] font-semibold leading-tight ${
                            done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                          }`}>
                            {i + 1}. {step.title}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                            {step.description}
                          </div>
                          {step.resource_url && (
                            <a href={step.resource_url} target="_blank" rel="noopener noreferrer"
                              className="mt-1.5 inline-block text-[11px] font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400"
                            >
                              查看资源 →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-200/40 px-4 py-2.5 dark:border-slate-800/40">
              <div className="flex items-center gap-2">
                <button onClick={exitAiFocus}
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  返回全景
                </button>
                <button className="flex-1 rounded-lg bg-slate-900 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                  保存路径
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Tutor bar ── */}
      <FloatingAITutor
        trackLabel="反淘生态探索"
        leftOffsetPx={0}
        rightOffsetPx={inAiFocus ? 340 : 0}
        isLoggedIn={false}
        disabled={false}
        disableWhenOffset={false}
        apiPath="/api/v1/explore/chat"
        apiExtraBody={{ graph_context: graphContext }}
        onResponse={handleAIResponse}
        quickQuestions={QUICK_QUESTIONS[selectedRole] || QUICK_QUESTIONS.buyer}
      />
    </div>
  );
}
