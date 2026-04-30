"""AntiTao knowledge graph: load / save / default seed.

Schema (top-level):
    {
      "version": 1,
      "tracks": [{"id", "label{zh,en}", "color"}],
      "nodes": [{
          "id", "track_ids[]", "title{zh,en}", "summary{zh,en}",
          "tags[]", "estimated_minutes",
          "prerequisites[]"        # node ids
          "validation_questions[]" # [{zh,en}]
          "mastery_criteria{zh,en}",
          "resources[]"            # [{type, title{zh,en}, url, summary{zh,en}}]
      }]
    }
"""

from __future__ import annotations

from copy import deepcopy
import json
from typing import Any

from deeptutor.services.path_service import get_path_service

_path_service = get_path_service()
GRAPH_FILE = _path_service.get_settings_file("antitao_knowledge_graph")


DEFAULT_KNOWLEDGE_GRAPH: dict[str, Any] = {
    "version": 1,
    "tracks": [
        {
            "id": "seller",
            "label": {"zh": "卖家", "en": "Seller"},
            "color": "#1a73e8",
        },
        {
            "id": "operator",
            "label": {"zh": "运营", "en": "Operator"},
            "color": "#7b1fa2",
        },
    ],
    "nodes": [
        # ─── Foundation (both tracks) ──────────────────────────────────────
        {
            "id": "antitao-concept",
            "track_ids": ["seller", "operator"],
            "title": {"zh": "反淘是什么", "en": "What is AntiTao"},
            "summary": {
                "zh": "用一句话讲清反淘的定义、与普通跨境电商的核心差异、以及它为什么在过去 3 年成为新机会。",
                "en": "What AntiTao is in one sentence, how it differs from normal cross-border e-commerce, and why it became a new opportunity in the last 3 years.",
            },
            "tags": ["foundation", "concept"],
            "estimated_minutes": 6,
            "prerequisites": [],
            "validation_questions": [
                {
                    "zh": "反淘和普通跨境电商的核心区别是什么？",
                    "en": "What is the core difference between AntiTao and normal cross-border e-commerce?",
                },
                {
                    "zh": "海外买家为什么愿意从中国平台买？",
                    "en": "Why do overseas buyers actively purchase from Chinese platforms?",
                },
            ],
            "mastery_criteria": {
                "zh": "能用自己的话讲清反淘的定义、卖家/代理平台/海外买家 3 个核心角色与跨境电商的根本差异",
                "en": "Can explain in own words the definition, the 3 core roles of seller / agent platform / overseas buyer, and the fundamental contrast with cross-border e-commerce",
            },
            "resources": [
                {
                    "type": "article",
                    "title": {"zh": "反淘从 0 到 1：行业概览（飞书文档）", "en": "AntiTao 0→1 industry overview (Feishu)"},
                    "url": "https://xcn8pgdlg8x0.feishu.cn/wiki/RmmJwBcJjiM4mzks2z2cjyQvnFc",
                    "summary": {"zh": "反淘的起源、市场规模、关键玩家清单。", "en": "Origins, market size, key players."},
                },
                {
                    "type": "article",
                    "title": {"zh": "反向海淘 vs 跨境电商：5 张图看清差异", "en": "AntiTao vs cross-border: 5 diagrams"},
                    "url": "https://xcn8pgdlg8x0.feishu.cn/wiki/RmmJwBcJjiM4mzks2z2cjyQvnFc",
                    "summary": {"zh": "用对比图把两种业务模式的差异讲清楚。", "en": "Side-by-side comparison."},
                },
            ],
        },
        {
            "id": "roles-value-flow",
            "track_ids": ["seller", "operator"],
            "title": {"zh": "角色与价值流向", "en": "Roles and Value Flow"},
            "summary": {
                "zh": "卖家、代理平台、海外买家分别在做什么、各自靠什么获得价值，钱、货和服务费在链路里如何流转。",
                "en": "What sellers, agent platforms, and overseas buyers each do; how each gains value; and how money, goods, and service fees move through the chain.",
            },
            "tags": ["foundation", "roles"],
            "estimated_minutes": 8,
            "prerequisites": ["antitao-concept"],
            "validation_questions": [
                {
                    "zh": "代理平台和卖家分别赚的是什么钱？为什么一般不能把代理平台收入说成商品佣金？",
                    "en": "What money do agent platforms vs sellers actually earn? Why should agent platform revenue not usually be described as product commission?",
                },
                {
                    "zh": "如果买家退款，损失最终落在谁身上？",
                    "en": "If a buyer refunds, who ultimately bears the loss?",
                },
            ],
            "mastery_criteria": {
                "zh": "能用文字说明「钱、货、服务费」分别经过哪些角色，并解释卖家收入与代理平台服务费的区别",
                "en": "Can explain in words how money, goods, and service fees move across roles, and distinguish seller revenue from agent platform service fees",
            },
            "resources": [
                {
                    "type": "doc",
                    "title": {"zh": "反淘 3 角色价值流向", "en": "AntiTao 3-role value flow"},
                    "url": "https://xcn8pgdlg8x0.feishu.cn/wiki/RmmJwBcJjiM4mzks2z2cjyQvnFc",
                    "summary": {"zh": "卖家/代理平台/海外买家的钱、货与服务费流动。", "en": "Money, goods, and service-fee flow among sellers, agent platforms, and overseas buyers."},
                },
            ],
        },
        {
            "id": "chain-relationship",
            "track_ids": ["seller", "operator"],
            "title": {"zh": "Weidian / 淘宝 / 1688 / 店铺 / 代理平台 关系", "en": "Weidian / Taobao / 1688 / Stores / Proxy Platforms"},
            "summary": {
                "zh": "Weidian、淘宝、1688、店铺和代理平台在反淘链路里各自扮演什么角色，买家在哪里提交购买，代理平台如何完成代采和集运。",
                "en": "What roles Weidian, Taobao, 1688, stores, and agent platforms play; where buyers submit purchase requests; and how agent platforms handle purchasing and consolidation.",
            },
            "tags": ["foundation", "platforms"],
            "estimated_minutes": 10,
            "prerequisites": ["roles-value-flow"],
            "validation_questions": [
                {
                    "zh": "买家最终是在哪里提交购买和支付服务费用的？",
                    "en": "Where does the buyer submit the purchase request and pay service-related fees?",
                },
                {
                    "zh": "代理平台的核心价值是什么？为什么不能跳过它？",
                    "en": "What is the core value of proxy platforms? Why can't sellers bypass them?",
                },
            ],
            "mastery_criteria": {
                "zh": "能解释国内货源平台、店铺和代理平台之间的关系，并说清买家实际在哪一端完成购买请求",
                "en": "Can explain the relationship among domestic source platforms, stores, and agent platforms, and where buyers actually submit purchase requests",
            },
            "resources": [],
        },

        # ─── Buyer journey (both tracks) ───────────────────────────────────
        {
            "id": "buyer-journey-discovery",
            "track_ids": ["seller", "operator"],
            "title": {"zh": "买家从哪里看到商品", "en": "Where Buyers Discover Products"},
            "summary": {
                "zh": "Reddit、Discord、TikTok、Instagram 上买家是怎么被「种草」的，哪种类型内容最容易转化。",
                "en": "How buyers get hooked on Reddit, Discord, TikTok, Instagram — and which content formats convert best.",
            },
            "tags": ["traffic", "discovery"],
            "estimated_minutes": 10,
            "prerequisites": ["chain-relationship"],
            "validation_questions": [
                {
                    "zh": "Reddit 上反淘买家最常聚集的 2 个 subreddit 是什么？",
                    "en": "What are the 2 subreddits where AntiTao buyers most often gather?",
                },
                {
                    "zh": "Discord 群和 Reddit 帖子在转化路径上有什么差别？",
                    "en": "What's the difference between Discord communities and Reddit posts in the conversion funnel?",
                },
            ],
            "mastery_criteria": {
                "zh": "能列出 3 个主要发现渠道 + 对应的内容类型 + 各自的转化特征",
                "en": "Can list 3 main discovery channels with their content formats and conversion traits",
            },
            "resources": [],
        },
        {
            "id": "buyer-journey-purchase",
            "track_ids": ["seller", "operator"],
            "title": {"zh": "买家下单链路全图", "en": "Full Purchase-Path Map"},
            "summary": {
                "zh": "从看到商品到付款的完整链路：哪一步卡点最严重、哪一步流失最大。",
                "en": "Full path from product discovery to payment — where the worst friction is and where most users drop off.",
            },
            "tags": ["funnel", "conversion"],
            "estimated_minutes": 12,
            "prerequisites": ["buyer-journey-discovery"],
            "validation_questions": [
                {
                    "zh": "下单流程里最常见的流失点是哪一步？",
                    "en": "Where in the purchase flow is the most common drop-off?",
                },
                {
                    "zh": "「不认识中文」对买家流失影响有多大？",
                    "en": "How much does language barrier impact buyer drop-off?",
                },
            ],
            "mastery_criteria": {
                "zh": "能按顺序说清下单链路，并指出 3 个最大流失点和对应解决方向",
                "en": "Can explain the purchase path in order, then identify 3 biggest drop-offs and matching mitigations",
            },
            "resources": [],
        },
        {
            "id": "buyer-journey-fulfillment",
            "track_ids": ["seller", "operator"],
            "title": {"zh": "履约：货怎么从中国到海外", "en": "Fulfillment: From China to Overseas"},
            "summary": {
                "zh": "代发、集货仓、转运、关税——一单从仓库出发到买家手里到底经过几道关。",
                "en": "Drop-ship, consolidation warehouse, forwarding, customs — every step a parcel passes from warehouse to buyer.",
            },
            "tags": ["fulfillment", "logistics"],
            "estimated_minutes": 10,
            "prerequisites": ["buyer-journey-purchase"],
            "validation_questions": [
                {
                    "zh": "代发模式和集货仓模式的成本差异主要在哪？",
                    "en": "Where does the cost differ most between drop-ship and consolidation models?",
                },
                {
                    "zh": "巴西关税被卡时最常见的处理办法是什么？",
                    "en": "What's the most common way to handle stuck-at-customs cases in Brazil?",
                },
            ],
            "mastery_criteria": {
                "zh": "能列出履约 4 种主要模式 + 各自适合的客单价区间",
                "en": "Can list 4 main fulfillment models and which AOV range each fits",
            },
            "resources": [],
        },

        # ─── Seller-specific ───────────────────────────────────────────────
        {
            "id": "seller-channel-selection",
            "track_ids": ["seller"],
            "title": {"zh": "选哪些渠道卖货", "en": "Choosing Sales Channels"},
            "summary": {
                "zh": "对卖家来说哪些 Reddit / Discord / TikTok 渠道值得重点投入，哪些已经饱和。",
                "en": "Which Reddit / Discord / TikTok channels are worth a seller's focus, and which are already saturated.",
            },
            "tags": ["seller", "channels"],
            "estimated_minutes": 12,
            "prerequisites": ["buyer-journey-discovery"],
            "validation_questions": [
                {
                    "zh": "判断一个 Discord 频道值不值得入驻，你会看哪 3 个指标？",
                    "en": "Which 3 metrics tell you whether a Discord channel is worth joining?",
                },
            ],
            "mastery_criteria": {
                "zh": "能给出自己当前类目的「3 个值得 + 3 个避开」渠道清单及理由",
                "en": "Can produce a 3-yes / 3-no channel list for own category with rationale",
            },
            "resources": [],
        },
        {
            "id": "seller-promotion-paths",
            "track_ids": ["seller"],
            "title": {"zh": "推广三条路：平台 / KOL / 自营", "en": "Promotion: Platform / KOL / Owned"},
            "summary": {
                "zh": "三种主要推广路径的成本结构、起效周期、适用阶段。",
                "en": "Cost structure, time-to-impact, and stage fit for the 3 main promotion paths.",
            },
            "tags": ["seller", "promotion"],
            "estimated_minutes": 14,
            "prerequisites": ["seller-channel-selection"],
            "validation_questions": [
                {
                    "zh": "起步阶段的卖家更适合哪一条路？为什么？",
                    "en": "Which path suits early-stage sellers best? Why?",
                },
            ],
            "mastery_criteria": {
                "zh": "能根据自己当前订单量、预算、内容能力给出推广路径优先级排序",
                "en": "Can rank the 3 paths by priority based on own order volume, budget, and content capacity",
            },
            "resources": [],
        },
        {
            "id": "seller-kol-cooperation",
            "track_ids": ["seller"],
            "title": {"zh": "KOL 合作的实操", "en": "KOL Cooperation Playbook"},
            "summary": {
                "zh": "怎么找到合适的 KOL、怎么谈合作、怎么计算 ROI、合作翻车的常见原因。",
                "en": "Finding the right KOLs, negotiating deals, calculating ROI, and the most common failure modes.",
            },
            "tags": ["seller", "kol"],
            "estimated_minutes": 18,
            "prerequisites": ["seller-promotion-paths"],
            "validation_questions": [
                {
                    "zh": "一次 KOL 合作的最低 ROI 警戒线你定多少？",
                    "en": "What minimum ROI threshold do you set as the alert line for a KOL deal?",
                },
            ],
            "mastery_criteria": {
                "zh": "能写出一份可执行的 KOL 合作 SOP（找人/谈/付款/复盘）",
                "en": "Can write an actionable KOL cooperation SOP (sourcing/negotiation/payment/review)",
            },
            "resources": [],
        },
        {
            "id": "seller-result-review",
            "track_ids": ["seller"],
            "title": {"zh": "数据复盘 4 维度", "en": "4-Dimension Data Review"},
            "summary": {
                "zh": "卖家复盘只看这 4 个维度：流量、转化、履约、利润——以及每个维度的预警线。",
                "en": "A seller review should focus only on 4 dimensions: traffic, conversion, fulfillment, profit — with alert lines for each.",
            },
            "tags": ["seller", "review", "data"],
            "estimated_minutes": 10,
            "prerequisites": ["buyer-journey-fulfillment", "seller-promotion-paths"],
            "validation_questions": [
                {
                    "zh": "如果转化率比上月低 30%，你的诊断顺序是什么？",
                    "en": "If conversion rate dropped 30% vs last month, what's your diagnostic sequence?",
                },
            ],
            "mastery_criteria": {
                "zh": "能在 5 分钟内对一周数据完成 4 维度排序 + 给出下一步动作",
                "en": "Can complete a 4-dimension sort + next-step action on a week's data within 5 minutes",
            },
            "resources": [],
        },

        # ─── Operator-specific ─────────────────────────────────────────────
        {
            "id": "operator-platform-mechanics",
            "track_ids": ["operator"],
            "title": {"zh": "平台运作内部机制", "en": "Platform Internal Mechanics"},
            "summary": {
                "zh": "代理平台后台是怎么处理订单、服务费、对账、退款和分润的——决定运营该往哪些地方下功夫。",
                "en": "How the agent platform backend handles orders, service fees, reconciliation, refunds, and revenue sharing — defines where ops effort matters.",
            },
            "tags": ["operator", "mechanics"],
            "estimated_minutes": 15,
            "prerequisites": ["chain-relationship"],
            "validation_questions": [
                {
                    "zh": "平台对账延迟会怎么影响卖家心智？",
                    "en": "How does reconciliation latency hit seller perception?",
                },
            ],
            "mastery_criteria": {
                "zh": "能用文字列出平台后台 5 个核心模块，并说明它们之间的数据依赖",
                "en": "Can list 5 core back-office modules in words and explain their data dependencies",
            },
            "resources": [],
        },
        {
            "id": "operator-traffic-channels",
            "track_ids": ["operator"],
            "title": {"zh": "平台引流渠道结构", "en": "Platform Traffic Channel Mix"},
            "summary": {
                "zh": "对平台来说哪些渠道是「自然流」、哪些是付费流、哪些是合作 KOL / 版主带来的。",
                "en": "From the platform's view: which channels are organic, which are paid, which come from KOL / mod partnerships.",
            },
            "tags": ["operator", "traffic"],
            "estimated_minutes": 12,
            "prerequisites": ["buyer-journey-discovery", "operator-platform-mechanics"],
            "validation_questions": [
                {
                    "zh": "平台流量结构里「不可控变量」最大的是哪一类？",
                    "en": "Which traffic source carries the highest uncontrollable risk?",
                },
            ],
            "mastery_criteria": {
                "zh": "能给出当前渠道组合的「健康度评分」+ 该补哪条腿",
                "en": "Can score current channel mix's health and identify which leg to reinforce",
            },
            "resources": [],
        },
        {
            "id": "operator-monetization",
            "track_ids": ["operator"],
            "title": {"zh": "平台收入模型", "en": "Platform Monetization Model"},
            "summary": {
                "zh": "代理平台主要收入：采购/仓储/质检/集运/物流服务费、汇率差、增值服务、达人/广告合作。每种适合什么阶段。",
                "en": "Main agent platform revenue streams: purchase / warehousing / QC / consolidation / logistics service fees, FX spread, value-added services, and creator / ad partnerships. Which stage each fits.",
            },
            "tags": ["operator", "revenue"],
            "estimated_minutes": 10,
            "prerequisites": ["operator-platform-mechanics"],
            "validation_questions": [
                {
                    "zh": "为什么早期平台不应该靠广告收入？",
                    "en": "Why shouldn't early-stage platforms rely on ad revenue?",
                },
            ],
            "mastery_criteria": {
                "zh": "能为当前阶段平台给出「主收入 + 辅收入」的优先级",
                "en": "Can prioritize primary + secondary revenue streams for current stage",
            },
            "resources": [],
        },
        {
            "id": "operator-system-design",
            "track_ids": ["operator"],
            "title": {"zh": "后台系统设计", "en": "Back-office System Design"},
            "summary": {
                "zh": "平台后台 MVP 应该长什么样：订单、对账、客服、分润、风控 5 个模块的最小可行设计。",
                "en": "What a platform back-office MVP should look like: orders, reconciliation, support, revenue share, risk — minimum viable for each.",
            },
            "tags": ["operator", "system"],
            "estimated_minutes": 20,
            "prerequisites": ["operator-monetization"],
            "validation_questions": [
                {
                    "zh": "风控模块在 MVP 里能砍多少？为什么？",
                    "en": "How much of the risk module can be cut in MVP? Why?",
                },
            ],
            "mastery_criteria": {
                "zh": "能用文字说明 5 模块系统架构、数据流向，以及 MVP 阶段哪些可以先砍掉",
                "en": "Can explain the 5-module architecture, data flow, and what can be trimmed in the MVP stage",
            },
            "resources": [],
        },
    ],
}


def load_antitao_knowledge_graph() -> dict[str, Any]:
    """Load graph from disk; fall back to default seed if missing."""
    try:
        if GRAPH_FILE.exists():
            with GRAPH_FILE.open("r", encoding="utf-8") as f:
                return json.load(f)
    except (OSError, json.JSONDecodeError):
        pass
    return deepcopy(DEFAULT_KNOWLEDGE_GRAPH)


def save_antitao_knowledge_graph(graph: dict[str, Any]) -> dict[str, Any]:
    """Persist graph to disk; basic validation."""
    if not isinstance(graph, dict) or "nodes" not in graph:
        raise ValueError("invalid_graph_payload")
    GRAPH_FILE.parent.mkdir(parents=True, exist_ok=True)
    with GRAPH_FILE.open("w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)
    return graph


# ─── Pure graph algorithms ────────────────────────────────────────────────


def get_node_by_id(graph: dict[str, Any], node_id: str) -> dict[str, Any] | None:
    for n in graph.get("nodes", []):
        if n.get("id") == node_id:
            return n
    return None


def get_unlocked_nodes(graph: dict[str, Any], mastered_ids: list[str]) -> list[dict[str, Any]]:
    """Return nodes whose prerequisites are all in mastered_ids and themselves not mastered."""
    mastered = set(mastered_ids or [])
    unlocked: list[dict[str, Any]] = []
    for n in graph.get("nodes", []):
        if n["id"] in mastered:
            continue
        prereqs = set(n.get("prerequisites", []) or [])
        if prereqs.issubset(mastered):
            unlocked.append(n)
    return unlocked


def recommend_next_nodes(
    graph: dict[str, Any],
    mastered_ids: list[str],
    track_id: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Sort unlocked nodes by:
    1) belongs to requested track first (if track_id given)
    2) more downstream dependencies first (foundational nodes prioritized)
    3) shorter estimated_minutes first (quick wins)
    """
    unlocked = get_unlocked_nodes(graph, mastered_ids)
    if track_id:
        unlocked = [n for n in unlocked if track_id in (n.get("track_ids") or [])]

    # count how many other nodes depend on each candidate
    downstream_count: dict[str, int] = {}
    for n in graph.get("nodes", []):
        for dep in n.get("prerequisites", []) or []:
            downstream_count[dep] = downstream_count.get(dep, 0) + 1

    def sort_key(n: dict[str, Any]) -> tuple[int, int, int]:
        return (
            -downstream_count.get(n["id"], 0),  # more downstream → higher priority
            n.get("estimated_minutes", 99),     # shorter first
            len(n.get("prerequisites") or []),  # fewer prerequisites first
        )

    return sorted(unlocked, key=sort_key)[:limit]
