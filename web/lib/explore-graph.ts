/** Types and default data for the /explore knowledge graph. */

export interface ExploreDomain {
  id: string;
  label: { zh: string; en: string };
  summary: { zh: string; en: string };
  color: string;
}

export interface ExploreNodeConnection {
  target: string;
  relation: string;
}

export interface ExploreNode {
  id: string;
  domain: string;
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  tags: string[];
  connections: ExploreNodeConnection[];
}

export interface ExploreGraph {
  version: number;
  domains: ExploreDomain[];
  nodes: ExploreNode[];
}

export const DEFAULT_EXPLORE_GRAPH: ExploreGraph = {
  version: 1,
  domains: [
    {
      id: "traffic",
      label: { zh: "流量层", en: "Traffic" },
      summary: { zh: "买家从哪来", en: "Where buyers come from" },
      color: "#f59e0b",
    },
    {
      id: "trade",
      label: { zh: "交易层", en: "Trade" },
      summary: { zh: "在哪成交", en: "Where transactions happen" },
      color: "#3b82f6",
    },
    {
      id: "fulfillment",
      label: { zh: "履约层", en: "Fulfillment" },
      summary: { zh: "货怎么交付", en: "How goods are delivered" },
      color: "#10b981",
    },
    {
      id: "infra",
      label: { zh: "基建层", en: "Infrastructure" },
      summary: { zh: "底层靠什么", en: "What underpins everything" },
      color: "#8b5cf6",
    },
  ],
  nodes: [
    {
      id: "kol_general",
      domain: "traffic",
      title: { zh: "达人 / KOL", en: "KOL / Influencers" },
      summary: { zh: "在 TikTok、小红书、YouTube 等平台通过内容吸引海外买家，是反淘流量最核心的来源", en: "Content creators on TikTok, RedNote, YouTube who attract overseas buyers" },
      tags: ["kol", "traffic"],
      connections: [
        { target: "ecom_platform", relation: "带货接入" },
        { target: "seller_distributor", relation: "直接供货" },
      ],
    },
    {
      id: "private_community",
      domain: "traffic",
      title: { zh: "私域社区", en: "Private Communities" },
      summary: { zh: "Discord 服务器、微信群、Telegram 群组——达人将公域流量沉淀为私域，复购率更高", en: "Discord servers, WeChat groups, Telegram — KOLs convert public traffic to private" },
      tags: ["community", "traffic"],
      connections: [
        { target: "kol_general", relation: "达人延伸" },
        { target: "seller_distributor", relation: "社群团购" },
      ],
    },
    {
      id: "reddit_community",
      domain: "traffic",
      title: { zh: "独立社区 (Reddit)", en: "Independent Community (Reddit)" },
      summary: { zh: "Reddit 是特殊社区形态——不是达人私域延伸，而是由意见领袖和版主管理的公共讨论区", en: "Reddit — not a KOL extension but public forums. Subreddits like r/RepFashion are key traffic sources" },
      tags: ["community", "traffic"],
      connections: [
        { target: "ecom_platform", relation: "导流至平台" },
        { target: "seller_distributor", relation: "直接对接卖家" },
      ],
    },
    {
      id: "platform_traffic",
      domain: "traffic",
      title: { zh: "平台自有流量", en: "Platform Organic Traffic" },
      summary: { zh: "电商平台本身也是流量来源——TikTok Shop 的内容推荐、淘宝的搜索流量、独立站的 SEO", en: "Platforms generate their own traffic via algorithms, search, SEO" },
      tags: ["platforms", "traffic"],
      connections: [
        { target: "ecom_platform", relation: "平台内置" },
      ],
    },
    {
      id: "ecom_platform",
      domain: "trade",
      title: { zh: "电商平台", en: "E-commerce Platforms" },
      summary: { zh: "淘宝、拼多多、抖音电商、京东——国内最大的货品供给池", en: "Taobao, PDD, Douyin ecom, JD — China's largest product supply pools" },
      tags: ["platforms", "trade"],
      connections: [
        { target: "seller_distributor", relation: "货源供给" },
        { target: "domestic_api", relation: "API 对接" },
        { target: "payment_api", relation: "支付结算" },
      ],
    },
    {
      id: "agent_platform",
      domain: "trade",
      title: { zh: "代理平台", en: "Agent Platforms" },
      summary: { zh: "Wegobuy、Pandabuy、Superbuy——海外买家代购中国商品的一站式平台", en: "Wegobuy, Pandabuy, Superbuy — one-stop proxy shopping platforms" },
      tags: ["platforms", "trade"],
      connections: [
        { target: "ecom_platform", relation: "对接货源" },
        { target: "warehouse_logistics", relation: "仓储物流" },
        { target: "kol_general", relation: "达人推广" },
      ],
    },
    {
      id: "standalone_site",
      domain: "trade",
      title: { zh: "独立站 / 直销", en: "Standalone / DTC" },
      summary: { zh: "用 Shopify、WooCommerce 或自建站直接面向海外消费者", en: "Shopify, WooCommerce, or custom stores selling directly to overseas consumers" },
      tags: ["platforms", "trade"],
      connections: [
        { target: "payment_api", relation: "支付接入" },
        { target: "warehouse_logistics", relation: "物流对接" },
        { target: "kol_general", relation: "达人引流" },
      ],
    },
    {
      id: "social_commerce",
      domain: "trade",
      title: { zh: "社交电商 / 直播带货", en: "Social Commerce / Live Selling" },
      summary: { zh: "通过 TikTok Live、Instagram Shopping、WhatsApp 直接成交", en: "Selling directly via TikTok Live, Instagram Shopping, WhatsApp" },
      tags: ["channels", "trade"],
      connections: [
        { target: "kol_general", relation: "达人主阵地" },
        { target: "payment_api", relation: "支付链路" },
      ],
    },
    {
      id: "seller_distributor",
      domain: "fulfillment",
      title: { zh: "代购 / 分销卖家", en: "Reseller / Distributor" },
      summary: { zh: "反淘生态核心角色——在国内平台选品、加价后卖给海外买家", en: "Core role — source products from Chinese platforms and resell to overseas buyers" },
      tags: ["seller", "fulfillment"],
      connections: [
        { target: "ecom_platform", relation: "选品采购" },
        { target: "warehouse_logistics", relation: "发货履约" },
        { target: "kol_general", relation: "达人合作" },
      ],
    },
    {
      id: "warehouse_logistics",
      domain: "fulfillment",
      title: { zh: "仓储 / 集运 / 国际物流", en: "Warehouse / Consolidation / Shipping" },
      summary: { zh: "国内仓库收货验货 → 合包集运 → 国际快递 → 海外派送，履约命脉", en: "China warehouse → consolidation → international shipping → overseas delivery" },
      tags: ["logistics", "fulfillment"],
      connections: [
        { target: "seller_distributor", relation: "卖家发货" },
        { target: "agent_platform", relation: "平台集运" },
      ],
    },
    {
      id: "qc_inspection",
      domain: "fulfillment",
      title: { zh: "质检 / 验货服务", en: "QC / Inspection" },
      summary: { zh: "仓库拍照验货、检查瑕疵，减少海外买家收到次品的风险", en: "In-warehouse photo inspection to reduce defective product risks" },
      tags: ["logistics", "fulfillment"],
      connections: [
        { target: "warehouse_logistics", relation: "入库环节" },
        { target: "agent_platform", relation: "平台增值服务" },
      ],
    },
    {
      id: "payment_api",
      domain: "infra",
      title: { zh: "跨境支付 / 结算 API", en: "Cross-border Payment API" },
      summary: { zh: "Stripe、PayPal、Alipay+、Wise——解决付款和收款的底层问题", en: "Stripe, PayPal, Alipay+, Wise — payment and settlement infrastructure" },
      tags: ["payment", "infra"],
      connections: [
        { target: "ecom_platform", relation: "平台收款" },
        { target: "standalone_site", relation: "独立站支付" },
        { target: "seller_distributor", relation: "卖家提现" },
      ],
    },
    {
      id: "domestic_api",
      domain: "infra",
      title: { zh: "国内电商 / 供应链 API", en: "Domestic E-com / Supply Chain API" },
      summary: { zh: "1688、淘宝开放平台、拼多多 API——程序化获取商品信息、下单、查物流", en: "1688, Taobao Open Platform, PDD API — programmatic product data and order management" },
      tags: ["system", "infra"],
      connections: [
        { target: "ecom_platform", relation: "数据接口" },
        { target: "agent_platform", relation: "商品同步" },
        { target: "standalone_site", relation: "一键铺货" },
      ],
    },
    {
      id: "supply_chain_upstream",
      domain: "infra",
      title: { zh: "供应链上游 / 工厂", en: "Upstream Supply Chain / Factories" },
      summary: { zh: "1688 供应商、广州/义乌档口、工厂直供——利润空间最大的模式", en: "1688 suppliers, Guangzhou/Yiwu wholesale, factory direct — highest margin model" },
      tags: ["revenue", "infra"],
      connections: [
        { target: "seller_distributor", relation: "直供" },
        { target: "ecom_platform", relation: "平台供货" },
      ],
    },
    {
      id: "currency_tax",
      domain: "infra",
      title: { zh: "换汇 / 税务合规", en: "FX / Tax Compliance" },
      summary: { zh: "外汇结算、离岸账户、各国关税和增值税——做大了绕不开的红线", en: "FX settlement, offshore accounts, customs and VAT — unavoidable at scale" },
      tags: ["system", "infra"],
      connections: [
        { target: "payment_api", relation: "结算环节" },
        { target: "warehouse_logistics", relation: "清关" },
      ],
    },
  ],
};

/** Compute fixed 2x2 grid positions for the 4-domain layout. */
export function computeDomainLayout(
  domains: ExploreDomain[],
  nodes: ExploreNode[],
  canvasW = 1200,
  canvasH = 900,
) {
  const gap = 60;
  const domainW = (canvasW - gap * 3) / 2;
  const domainH = (canvasH - gap * 3) / 2;

  const positions: Record<string, { x: number; y: number }> = {};

  domains.forEach((domain, di) => {
    const col = di % 2;
    const row = Math.floor(di / 2);
    const originX = gap + col * (domainW + gap);
    const originY = gap + row * (domainH + gap);

    const domainNodes = nodes.filter((n) => n.domain === domain.id);
    const nodeH = 110;
    const nodeGap = 20;
    const totalH = domainNodes.length * (nodeH + nodeGap) - nodeGap;
    const startY = originY + (domainH - totalH) / 2;

    domainNodes.forEach((node, ni) => {
      positions[node.id] = {
        x: originX + domainW / 2 - 140, // center nodes, 280px wide
        y: startY + ni * (nodeH + nodeGap),
      };
    });
  });

  return positions;
}

/** Get domain info by id */
export function getDomain(domains: ExploreDomain[], id: string): ExploreDomain | undefined {
  return domains.find((d) => d.id === id);
}
