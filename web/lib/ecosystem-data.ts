// ─── Ecosystem shared data ──────────────────────────────────────────
// 共享类型、阶段数据、飞书文档映射

import type { GraphNode } from "@/lib/knowledge-graph";
import { classifyNodeToRegion } from "@/lib/ecosystem";
import type { RegionId } from "@/lib/ecosystem";

export type Perspective = "buyer" | "platform" | "seller";

export type FlowStageId =
  | "traffic_entry"
  | "trust_building"
  | "order_decision"
  | "fulfillment"
  | "content_loop";

export interface SubModuleDef {
  id: string;
  title: { zh: string; en: string };
  what: { zh: string; en: string };
  why: { zh: string; en: string };
  actionLabel: { zh: string; en: string };
  feishuUrl?: string;
}

export interface FlowStageDef {
  id: FlowStageId;
  title: { zh: string; en: string };
  iconName: string;
  color: string;
  bgColor: string;
  region: { zh: string; color: string };
  essence: { zh: string; en: string };
  ecosystemPosition: {
    layer: { zh: string; color: string };
    upstream?: { zh: string };
    downstream?: { zh: string };
  };
  perspectives: Record<
    Perspective,
    { bullets: string[]; description: string }
  >;
  subModules: SubModuleDef[];
  feishuUrl?: string;
}

export interface ClassificationResult {
  stage: FlowStageId | null;
  confidence: "high" | "medium" | "low" | "fallback";
  matchedBy: string | null;
}

// ─── Focus direction (replaces old track system) ──────────────────

export type FocusDirectionId = "all" | "seller_growth" | "platform_ops";

export interface FocusDirectionDef {
  id: FocusDirectionId;
  label: string;
  shortLabel: string;
  /** Bridge to backend track_ids ("seller" / "operator") */
  legacyTrackId?: string;
}

export const FOCUS_DIRECTIONS: FocusDirectionDef[] = [
  { id: "all", label: "全部", shortLabel: "全部" },
  { id: "seller_growth", label: "卖家增长", shortLabel: "卖家", legacyTrackId: "seller" },
  { id: "platform_ops", label: "平台运营", shortLabel: "平台", legacyTrackId: "operator" },
];

// ─── Stage order (single source of truth for 5-stage sequence) ────

export const STAGE_ORDER: FlowStageId[] = [
  "traffic_entry",
  "trust_building",
  "order_decision",
  "fulfillment",
  "content_loop",
];

// ─── Node → stage classification ──────────────────────────────────

const STAGE_KEYWORDS: { stage: FlowStageId; pattern: RegExp; label: string }[] = [
  {
    stage: "traffic_entry",
    label: "traffic keywords",
    pattern: /discovery|traffic|kol|tiktok|channels?|promotion|发现|流量|达人|渠道|推广|引流|曝光|获取用户|从哪里|第一次.*看到|怎么.*发现/i,
  },
  {
    stage: "trust_building",
    label: "trust keywords",
    pattern: /review|qc|verification|discord|trust|reputation|feedback|信任|验证|质检|评价|口碑|社区反馈|信誉|靠谱|真假/i,
  },
  {
    stage: "order_decision",
    label: "order keywords",
    pattern: /conversion|platform|agent|payment|order|pricing|commission|下单|决策|代理|支付|定价|转化|购买|选择|怎么.*买|在哪里.*买/i,
  },
  {
    stage: "fulfillment",
    label: "fulfillment keywords",
    pattern: /logistics|shipping|warehouse|customs|delivery|fulfillment|物流|履约|仓储|配送|发货|清关|集运|海关|怎么.*到/i,
  },
  {
    stage: "content_loop",
    label: "content keywords",
    pattern: /sharing|unboxing|review|ugc|晒单|回流|分享|开箱|内容.*传播|二次.*传播|反馈.*优化|复购/i,
  },
];

const REGION_TO_STAGE: Record<RegionId, FlowStageId> = {
  traffic: "traffic_entry",
  transaction: "order_decision",
  fulfillment: "fulfillment",
  infrastructure: "content_loop",
};

/**
 * Classify a node into one of the 5 flow stages.
 * 3-tier fallback: explicit stage_ids → keyword matching → region mapping.
 */
export function classifyNodeToStage(node: GraphNode): FlowStageId | null {
  // 1. Explicit stage_ids field (preferred)
  if (node.stage_ids && node.stage_ids.length > 0) {
    return node.stage_ids[0];
  }

  // 2. Keyword matching on title + summary + tags
  const searchText = [
    node.title?.zh ?? "",
    node.title?.en ?? "",
    node.summary?.zh ?? "",
    node.summary?.en ?? "",
    ...(node.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  for (const { stage, pattern } of STAGE_KEYWORDS) {
    if (pattern.test(searchText)) {
      return stage;
    }
  }

  // 3. Fallback: region-based classification
  const region = classifyNodeToRegion(node);
  return REGION_TO_STAGE[region] ?? null;
}

/**
 * Map a node to its focus directions via legacy track_ids → FocusDirectionId bridge.
 * Returns ["all"] for nodes with no track match.
 */
export function classifyNodeToFocus(node: GraphNode): FocusDirectionId[] {
  const results: FocusDirectionId[] = [];
  for (const fd of FOCUS_DIRECTIONS) {
    if (fd.legacyTrackId && node.track_ids?.includes(fd.legacyTrackId)) {
      results.push(fd.id);
    }
  }
  return results.length > 0 ? results : ["all"];
}

/** Map legacy track_id ("seller"/"operator") to FocusDirectionId. */
export function legacyTrackToFocus(trackId: string): FocusDirectionId {
  const found = FOCUS_DIRECTIONS.find((fd) => fd.legacyTrackId === trackId);
  return found?.id ?? "all";
}

// ─── Feishu doc semantic map ──────────────────────────────────────

export const FEISHU_DOC_MAP: Record<string, string> = {
  // ── 流量入口 ──
  kol:             "https://xcn8pgdlg8x0.feishu.cn/wiki/DZnEwOo5gim2z6kI16Icx7hinFd",
  community:       "https://xcn8pgdlg8x0.feishu.cn/wiki/AlF3wRXYAiKugtkvx7Acqc0Vn6d",
  algorithm:       "https://xcn8pgdlg8x0.feishu.cn/wiki/FOmvwFeAPiLcBKk4Jntcd2AWnef",
  seo_ads:         "https://xcn8pgdlg8x0.feishu.cn/wiki/K461wUx5eic5GAkTDNtcGdtdn9b",
  traffic_entry:   "https://xcn8pgdlg8x0.feishu.cn/wiki/DZnEwOo5gim2z6kI16Icx7hinFd",
  // ── 信任建立 ──
  qc:              "https://xcn8pgdlg8x0.feishu.cn/wiki/OGm8woJvNiV7zUkz2oQcqaP4nve",
  community_trust: "https://xcn8pgdlg8x0.feishu.cn/wiki/JY0WwQE7oirzgzkNM2DcaNU3ndd",
  reviews:         "https://xcn8pgdlg8x0.feishu.cn/wiki/RUCBwjapDiVRs0kGvSbcXzaRnhh",
  trust_building:  "https://xcn8pgdlg8x0.feishu.cn/wiki/OGm8woJvNiV7zUkz2oQcqaP4nve",
  // ── 下单决策 ──
  agent_platform:  "https://xcn8pgdlg8x0.feishu.cn/wiki/Nemyw0zsOiPWSLkhJi7cZ5P6nwh",
  pricing:         "https://xcn8pgdlg8x0.feishu.cn/wiki/FloQw03LaiXCLxkD2rAcKrE3nAe",
  payment:         "https://xcn8pgdlg8x0.feishu.cn/wiki/H1Mlwdf55iXY0ukAvCHcaCYHnrh",
  order_decision:  "https://xcn8pgdlg8x0.feishu.cn/wiki/FVzswR9I2iyHZbkLJiIcitCrnFK",
  // ── 履约系统 ──
  warehouse:       "https://xcn8pgdlg8x0.feishu.cn/wiki/Nemyw0zsOiPWSLkhJi7cZ5P6nwh",
  consolidation:   "https://xcn8pgdlg8x0.feishu.cn/wiki/Fnxpwxl4xirdYfkBfNucdOBVnVJ",
  shipping:        "https://xcn8pgdlg8x0.feishu.cn/wiki/Fnxpwxl4xirdYfkBfNucdOBVnVJ",
  customs:         "https://xcn8pgdlg8x0.feishu.cn/wiki/H1Mlwdf55iXY0ukAvCHcaCYHnrh",
  fulfillment:     "https://xcn8pgdlg8x0.feishu.cn/wiki/Fnxpwxl4xirdYfkBfNucdOBVnVJ",
  // ── 内容回流 ──
  unboxing:        "https://xcn8pgdlg8x0.feishu.cn/wiki/RUCBwjapDiVRs0kGvSbcXzaRnhh",
  review_loop:     "https://xcn8pgdlg8x0.feishu.cn/wiki/YHp2w51PMicK6PkmOEVcsXhBneh",
  resharing:       "https://xcn8pgdlg8x0.feishu.cn/wiki/RUCBwjapDiVRs0kGvSbcXzaRnhh",
  content_loop:    "https://xcn8pgdlg8x0.feishu.cn/wiki/YHp2w51PMicK6PkmOEVcsXhBneh",
};

export function getFeishuUrl(topicId: string): string | undefined {
  return FEISHU_DOC_MAP[topicId] || undefined;
}

// ─── FLOW_STAGES ──────────────────────────────────────────────────

export const FLOW_STAGES: FlowStageDef[] = [
  {
    id: "traffic_entry",
    title: { zh: "流量入口", en: "Traffic Entry" },
    iconName: "Globe",
    color: "#0891b2",
    bgColor: "#0891b215",
    region: { zh: "流量层", color: "#0891b2" },
    essence: {
      zh: "商品信息如何跨越国界触达海外买家",
      en: "How product information crosses borders to reach overseas buyers",
    },
    ecosystemPosition: {
      layer: { zh: "流量层", color: "#0891b2" },
      downstream: { zh: "信任建立" },
    },
    perspectives: {
      buyer: {
        bullets: [
          "内容平台是发现商品的入口",
          "KOL 和社区影响购买兴趣",
          "信息流决定了看到什么商品",
        ],
        description: "买家如何发现商品——信息触达的起点",
      },
      platform: {
        bullets: [
          "流量分发是生态的血液系统",
          "内容创作者是核心流量节点",
          "算法决定了商品可见度",
        ],
        description: "流量在生态中的角色——连接供需的第一环",
      },
      seller: {
        bullets: [
          "被看见是成交的前提",
          "内容化是获取信任的敲门砖",
          "多平台曝光扩大触达面",
        ],
        description: "卖家视角——曝光即机会，理解流量运作逻辑",
      },
    },
    subModules: [
      {
        id: "kol",
        title: { zh: "KOL / 达人引流", en: "KOL Traffic" },
        what: { zh: "内容创作者通过测评、推荐将商品展示给目标受众的机制", en: "Mechanism where content creators showcase products to target audiences through reviews and recommendations" },
        why: { zh: "KOL 是反淘生态最大的信任杠杆，一条测评可以同时解决曝光和信任两个问题", en: "KOLs are the biggest trust lever in the reverse-shopping ecosystem" },
        actionLabel: { zh: "KOL 引流", en: "Learn: KOL Traffic" },
      },
      {
        id: "community",
        title: { zh: "私域社区沉淀", en: "Private Community" },
        what: { zh: "在 Discord / Telegram 等平台建立买家社群，形成独立于公域算法的流量池", en: "Building buyer communities on platforms like Discord/Telegram to form traffic pools independent of public algorithms" },
        why: { zh: "私域流量复购率高、获客成本低，是反淘卖家最稳定的订单来源", en: "Private traffic has higher repurchase rates and lower acquisition costs" },
        actionLabel: { zh: "私域社区", en: "Learn: Private Community" },
      },
      {
        id: "algorithm",
        title: { zh: "平台算法推荐", en: "Platform Algorithm" },
        what: { zh: "TikTok / 小红书等平台的推荐算法如何决定内容的分发范围和目标人群", en: "How platform recommendation algorithms determine content distribution scope and target audience" },
        why: { zh: "理解算法逻辑才能让商品内容获得更多自然流量，降低对 KOL 的依赖", en: "Understanding algorithms reduces dependency on KOLs for natural traffic" },
        actionLabel: { zh: "算法机制", en: "Learn: Algorithms" },
      },
      {
        id: "seo_ads",
        title: { zh: "搜索与付费投放", en: "Search & Paid Ads" },
        what: { zh: "通过搜索引擎优化和付费广告主动获取意向明确的买家流量", en: "Actively acquiring buyer traffic with clear intent through SEO and paid advertising" },
        why: { zh: "付费流量可控性强，适合验证新品和快速起量，是自然流量的补充手段", en: "Paid traffic offers controllability for testing new products and rapid scaling" },
        actionLabel: { zh: "投放策略", en: "Learn: Ad Strategy" },
      },
    ],
  },
  {
    id: "trust_building",
    title: { zh: "信任建立", en: "Trust Building" },
    iconName: "ShieldCheck",
    color: "#10b981",
    bgColor: "#10b98115",
    region: { zh: "交易层", color: "#7c3aed" },
    essence: {
      zh: "海外买家如何在没有实物接触的情况下建立对商品和卖家的信任",
      en: "How overseas buyers build trust in products and sellers without physical contact",
    },
    ecosystemPosition: {
      layer: { zh: "交易层", color: "#7c3aed" },
      upstream: { zh: "流量入口" },
      downstream: { zh: "下单决策" },
    },
    perspectives: {
      buyer: {
        bullets: [
          "QC 质检是跨境信任的核心机制",
          "社区口碑比官方宣传更可信",
          "信任需要多维度交叉验证",
        ],
        description: "买家如何验证商品真实性——跨境交易的信任基础设施",
      },
      platform: {
        bullets: [
          "信任体系决定平台交易天花板",
          "QC 和评价是信任基建的支柱",
          "透明度是降低交易摩擦的关键",
        ],
        description: "平台信任体系——让陌生人之间产生交易的基础",
      },
      seller: {
        bullets: [
          "口碑是卖家最核心的资产",
          "透明展示比过度包装更有说服力",
          "每一次交付都在积累或消耗信任",
        ],
        description: "卖家视角——信任就是转化率，信誉就是竞争力",
      },
    },
    subModules: [
      {
        id: "qc",
        title: { zh: "QC 质检验证", en: "QC Verification" },
        what: { zh: "在发货前由第三方或平台对商品进行拍照、检测，生成质检报告供买家查看", en: "Third-party or platform inspection with photos and reports before shipping" },
        why: { zh: "QC 是消除跨境交易信息不对称最直接的手段，直接影响买家的下单信心", en: "QC is the most direct way to eliminate information asymmetry in cross-border transactions" },
        actionLabel: { zh: "QC 质检", en: "Learn: QC" },
      },
      {
        id: "community_trust",
        title: { zh: "社区信誉系统", en: "Community Reputation" },
        what: { zh: "Reddit / Discord 等社区中形成的非正式评价体系，包括用户反馈、交易记录和口碑传播", en: "Informal reputation systems in Reddit/Discord communities through user feedback and word of mouth" },
        why: { zh: "社区信誉比平台评分更难造假，是资深买家最依赖的决策依据", en: "Community reputation is harder to fake than platform ratings" },
        actionLabel: { zh: "社区信誉", en: "Learn: Reputation" },
      },
      {
        id: "reviews",
        title: { zh: "评价与反馈循环", en: "Reviews & Feedback" },
        what: { zh: "买家收货后的评价如何影响后续买家的决策，形成信息积累的正向循环", en: "How post-purchase reviews influence future buyer decisions, creating a positive information loop" },
        why: { zh: "真实评价是最可持续的信任来源，也是卖家优化商品的第一手数据", en: "Authentic reviews are the most sustainable trust source and first-hand optimization data" },
        actionLabel: { zh: "评价体系", en: "Learn: Reviews" },
      },
    ],
  },
  {
    id: "order_decision",
    title: { zh: "下单决策", en: "Order Decision" },
    iconName: "ShoppingCart",
    color: "#f59e0b",
    bgColor: "#f59e0b15",
    region: { zh: "交易层", color: "#7c3aed" },
    essence: {
      zh: "买家在建立信任后，通过什么经济模型完成跨境购买决策",
      en: "The economic model through which buyers complete cross-border purchase decisions after trust is established",
    },
    ecosystemPosition: {
      layer: { zh: "交易层", color: "#7c3aed" },
      upstream: { zh: "信任建立" },
      downstream: { zh: "履约系统" },
    },
    perspectives: {
      buyer: {
        bullets: [
          "代购平台是跨境交易的中介层",
          "价格构成包含商品+服务+运费",
          "支付和汇率影响最终购买成本",
        ],
        description: "买家如何完成购买——从信任到交易的经济模型",
      },
      platform: {
        bullets: [
          "平台是买卖双方的撮合引擎",
          "转化率取决于信任和价格的平衡",
          "风控和结算系统保障交易安全",
        ],
        description: "平台角色——让交易在信任基础上高效达成",
      },
      seller: {
        bullets: [
          "定价的本质是信任溢价能力",
          "选品和利润核算决定生意天花板",
          "订单转化是前面所有环节的兑现",
        ],
        description: "卖家视角——转化是信任和价值的最终变现",
      },
    },
    subModules: [
      {
        id: "agent_platform",
        title: { zh: "代购平台模式", en: "Agent Platform Model" },
        what: { zh: "代购平台作为中介连接中国卖家和海外买家，提供选品展示、翻译、结算、集运等一站式服务", en: "Agent platforms connect Chinese sellers with overseas buyers, providing product display, translation, settlement, and consolidation" },
        why: { zh: "理解平台模式是理解整个反淘交易逻辑的钥匙——平台如何赚钱决定了生态的效率上限", en: "Understanding the platform model is key to grasping the entire reverse-shopping transaction logic" },
        actionLabel: { zh: "平台模式", en: "Learn: Platform Model" },
      },
      {
        id: "pricing",
        title: { zh: "定价与利润构成", en: "Pricing & Margin" },
        what: { zh: "跨境交易的价格由商品成本、平台服务费、物流费、汇率等多层叠加构成", en: "Cross-border pricing is composed of product cost, platform service fees, logistics, and exchange rates" },
        why: { zh: "价格透明度决定买家决策速度，利润空间决定卖家能否持续经营", en: "Price transparency drives buyer decision speed; margin determines seller sustainability" },
        actionLabel: { zh: "定价逻辑", en: "Learn: Pricing" },
      },
      {
        id: "payment",
        title: { zh: "支付与结算", en: "Payment & Settlement" },
        what: { zh: "跨境支付涉及多币种结算、汇率波动、支付渠道选择和安全风控等机制", en: "Cross-border payment involves multi-currency settlement, exchange rate fluctuation, channel selection, and security" },
        why: { zh: "支付是交易的最后一公里——支付体验直接影响转化率，结算效率影响卖家现金流", en: "Payment is the last mile of transaction — experience affects conversion, settlement speed affects cash flow" },
        actionLabel: { zh: "支付结算", en: "Learn: Payment" },
      },
    ],
  },
  {
    id: "fulfillment",
    title: { zh: "履约系统", en: "Fulfillment" },
    iconName: "Truck",
    color: "#ea580c",
    bgColor: "#ea580c15",
    region: { zh: "履约层", color: "#ea580c" },
    essence: {
      zh: "商品从中国卖家出发，经过仓储、质检、合箱、国际物流、清关，最终到达海外买家手中的物理链条",
      en: "The physical chain from Chinese sellers through warehousing, QC, consolidation, international logistics, and customs to overseas buyers",
    },
    ecosystemPosition: {
      layer: { zh: "履约层", color: "#ea580c" },
      upstream: { zh: "下单决策" },
      downstream: { zh: "内容回流" },
    },
    perspectives: {
      buyer: {
        bullets: [
          "履约是体验的核心——等待时间决定满意度",
          "物流链路复杂，每个环节都可能产生摩擦",
          "清关和税务是不可控的外部变量",
        ],
        description: "买家体验——从下单到收货的物理世界之旅",
      },
      platform: {
        bullets: [
          "仓储和物流是履约的基础设施",
          "合箱策略直接决定物流成本结构",
          "清关合规是平台跨境的准入门槛",
        ],
        description: "平台履约体系——管理和优化物理交付链路",
      },
      seller: {
        bullets: [
          "发货时效影响买家复购意愿",
          "物流成本是利润结构中的关键变量",
          "售后处理能力决定长期口碑",
        ],
        description: "卖家视角——交付是交易的最终交付物，也是口碑的起点",
      },
    },
    subModules: [
      {
        id: "warehouse",
        title: { zh: "国内仓储收货", en: "Warehouse Receiving" },
        what: { zh: "卖家将商品发往国内集运仓，仓库完成收货登记、初步质检和入库上架", en: "Sellers ship to domestic consolidation warehouses for receiving, initial QC, and shelving" },
        why: { zh: "仓储是履约链路的起点——入库效率直接影响后续所有环节的时效", en: "Warehousing is the starting point of fulfillment — receiving efficiency impacts all downstream timelines" },
        actionLabel: { zh: "仓储流程", en: "Learn: Warehousing" },
      },
      {
        id: "consolidation",
        title: { zh: "质检与合箱", en: "QC & Consolidation" },
        what: { zh: "仓库对商品进行二次质检拍照，将同一买家多笔订单的商品合并装箱以降低运费", en: "Warehouse performs secondary QC and consolidates multiple orders for the same buyer to reduce shipping costs" },
        why: { zh: "合箱是最直接影响物流成本和服务体验的环节——合得好省30%运费，合不好增加损坏风险", en: "Consolidation directly impacts logistics cost (up to 30% savings) and service quality" },
        actionLabel: { zh: "合箱策略", en: "Learn: Consolidation" },
      },
      {
        id: "shipping",
        title: { zh: "国际物流配送", en: "International Shipping" },
        what: { zh: "跨境包裹通过空运/海运/铁路等线路从中国发往目的国，涉及线路选择、时效管理和成本控制", en: "Cross-border parcels shipped via air/sea/rail from China to destination countries" },
        why: { zh: "物流线路的选择决定了时效、成本和可追踪性的三角平衡，是履约体验的核心", en: "Shipping route selection determines the balance of speed, cost, and traceability" },
        actionLabel: { zh: "物流线路", en: "Learn: Shipping" },
      },
      {
        id: "customs",
        title: { zh: "清关与税务", en: "Customs & Tax" },
        what: { zh: "包裹进入目的国时的海关申报、关税计算、合规审查和可能的查验流程", en: "Customs declaration, duty calculation, compliance review, and potential inspection upon entry" },
        why: { zh: "清关是跨境履约中最不确定的环节——政策变化和合规问题可能导致延误、退运甚至罚没", en: "Customs is the most uncertain part of cross-border fulfillment — policy changes can cause delays or rejection" },
        actionLabel: { zh: "清关知识", en: "Learn: Customs" },
      },
    ],
  },
  {
    id: "content_loop",
    title: { zh: "内容回流", en: "Content Loop" },
    iconName: "MessageCircle",
    color: "#8b5cf6",
    bgColor: "#8b5cf615",
    region: { zh: "基建层", color: "#6b7280" },
    essence: {
      zh: "买家收货后的分享行为如何转化为新一轮流量，形成生态的增长飞轮",
      en: "How post-purchase sharing behavior converts into new traffic, forming the ecosystem's growth flywheel",
    },
    ecosystemPosition: {
      layer: { zh: "基建层", color: "#6b7280" },
      upstream: { zh: "履约系统" },
      downstream: { zh: "流量入口" },
    },
    perspectives: {
      buyer: {
        bullets: [
          "开箱分享是社区文化的核心行为",
          "Review 和 Haul 内容影响下一批买家",
          "买家也是内容的创造者和传播者",
        ],
        description: "买家如何成为生态的参与者——从消费者到内容贡献者",
      },
      platform: {
        bullets: [
          "用户内容是生态增长的核心飞轮",
          "UGC 降低了平台的获客成本",
          "内容回流形成数据闭环驱动优化",
        ],
        description: "平台增长引擎——让每一次交易都成为下一次流量的起点",
      },
      seller: {
        bullets: [
          "优质交付带来好评，好评带来新订单",
          "买家内容是免费的品牌资产",
          "反馈闭环帮助持续优化商品",
        ],
        description: "卖家视角——交付质量驱动内容，内容驱动增长，形成正向循环",
      },
    },
    subModules: [
      {
        id: "unboxing",
        title: { zh: "开箱晒单文化", en: "Unboxing Culture" },
        what: { zh: "海外买家收到商品后拍摄开箱视频/照片分享到社区的行为模式及其传播机制", en: "The behavior pattern and spread mechanism of overseas buyers sharing unboxing content in communities" },
        why: { zh: "开箱内容是反淘生态最真实、最具感染力的内容形式——一条高质量 Haul 可以带来数百个新订单", en: "Unboxing content is the most authentic and viral content form — one quality haul can generate hundreds of new orders" },
        actionLabel: { zh: "内容模式", en: "Learn: Content" },
      },
      {
        id: "review_loop",
        title: { zh: "社区 Review 生态", en: "Community Review Ecosystem" },
        what: { zh: "Reddit / Discord 等社区中形成的 Review 文化，包括测评标准、评分惯例和信任传递机制", en: "Review culture in communities like Reddit/Discord, including standards, scoring conventions, and trust transfer" },
        why: { zh: "社区 Review 是去中心化的信任机制——买家更相信同类买家而非官方宣传", en: "Community reviews are a decentralized trust mechanism — buyers trust peers more than official marketing" },
        actionLabel: { zh: "Review 生态", en: "Learn: Reviews" },
      },
      {
        id: "resharing",
        title: { zh: "二次传播与裂变", en: "Re-sharing & Virality" },
        what: { zh: "买家内容被其他用户转发、截图、搬运到不同平台后产生的跨平台传播效应", en: "Cross-platform spread when buyer content is forwarded, screenshotted, or reposted to different platforms" },
        why: { zh: "二次传播让单次交易的价值被成倍放大——一次好的交付可能带来远超预期的回报", en: "Re-sharing multiplies the value of a single transaction — a good delivery can yield returns far beyond expectation" },
        actionLabel: { zh: "传播机制", en: "Learn: Virality" },
      },
    ],
  },
];

// ─── Topic lookup helper ──────────────────────────────────────────

/** 根据 ID 查找主题信息（先查子模块，再查阶段） */
export function findTopicById(topicId: string): {
  type: "stage" | "subModule";
  stage?: FlowStageDef;
  subModule?: SubModuleDef;
} | null {
  // 先搜子模块
  for (const stage of FLOW_STAGES) {
    const sm = stage.subModules.find((s) => s.id === topicId);
    if (sm) return { type: "subModule", stage, subModule: sm };
  }
  // 再搜阶段
  const stage = FLOW_STAGES.find((s) => s.id === topicId);
  if (stage) return { type: "stage", stage };
  return null;
}
