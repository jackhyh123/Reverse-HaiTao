import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";

export type AntitaoTrackId = "seller" | "operator";
export type LocalizedText = { zh: string; en: string };

export interface AntitaoTrackActionDefinition {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  prompt: LocalizedText;
  capability: "" | "deep_research";
}

export interface AntitaoTrackGateDefinition {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  common_questions: LocalizedText[];
  pass_standard: LocalizedText;
}

export interface AntitaoTrackDefinition {
  id: AntitaoTrackId;
  badge: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  summary: LocalizedText;
  outcome: LocalizedText;
  gates: AntitaoTrackGateDefinition[];
  actions: AntitaoTrackActionDefinition[];
}

export interface AntitaoCurriculum {
  version: number;
  updated_at?: string;
  tracks: AntitaoTrackDefinition[];
}

export interface AntitaoLocalizedTrackActionDefinition {
  id: string;
  title: string;
  description: string;
  prompt: string;
  capability: "" | "deep_research";
}

export interface AntitaoLocalizedTrackGateDefinition {
  id: string;
  title: string;
  description: string;
  commonQuestions: string[];
  passStandard: string;
}

export interface AntitaoLocalizedTrackDefinition {
  id: AntitaoTrackId;
  badge: string;
  title: string;
  subtitle: string;
  summary: string;
  outcome: string;
  gates: AntitaoLocalizedTrackGateDefinition[];
  actions: AntitaoLocalizedTrackActionDefinition[];
}

export interface AntitaoSystemBlockDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  href: string;
}

export interface AntitaoCoachDefinition {
  botId: string;
  trackId: AntitaoTrackId;
  titleKey: string;
  descriptionKey: string;
  focusKey: string;
}

export const DEFAULT_ANTITAO_CURRICULUM: AntitaoCurriculum = {
  version: 1,
  tracks: [
    {
      id: "seller",
      badge: { zh: "卖家通道", en: "Seller Track" },
      title: { zh: "新手卖家从 0 到 1 学习路径", en: "New Seller 0-to-1 Learning Path" },
      subtitle: {
        zh: "帮助新手卖家先听懂概念、看懂流程，再逐步形成能独立判断和复盘的小生意理解。",
        en: "Help new sellers understand concepts first, see the full flow, and gradually build independent judgment and review habits.",
      },
      summary: {
        zh: "这条路径不承诺立刻卖爆，而是帮助用户从完全不懂反向海淘，逐步走到能解释业务、理解链路、知道如何开始推广，并能对结果做基础复盘。",
        en: "This path does not promise instant breakout sales. It helps users go from zero knowledge to explaining the business, understanding the chain, starting promotion, and reviewing early results.",
      },
      outcome: {
        zh: "目标结果：用户开始像一个真正的卖家那样理解业务，而不是只会记住零散名词。",
        en: "Target outcome: the learner starts to think like a real seller instead of just memorizing isolated terms.",
      },
      actions: [
        {
          id: "seller-concept",
          title: { zh: "先听懂反淘是什么", en: "Understand what AntiTao is" },
          description: {
            zh: "从基本概念开始，用简单例子讲清角色、价值和赚钱逻辑。",
            en: "Start from the basics and explain roles, value, and monetization with simple examples.",
          },
          prompt: {
            zh: "请把反向海淘讲给一个完全不懂的新手卖家听，重点解释它是什么、和普通跨境电商有什么区别、卖家/代理平台/海外买家分别扮演什么角色，并说明代理平台主要收采购、仓储、质检、集运、国际物流等服务费，不要说成商品佣金。",
            en: "Explain reverse cross-border shopping to a complete beginner seller. Focus on what it is, how it differs from standard cross-border commerce, and the roles of seller, platform, proxy, and user, using one simple example.",
          },
          capability: "",
        },
        {
          id: "seller-flow",
          title: { zh: "讲清购买流程和角色关系", en: "Explain the purchase flow and roles" },
          description: {
            zh: "把用户购买流程讲成一条完整链路，帮助新手真正看懂关系。",
            en: "Turn the buyer journey into one clear chain so beginners can truly understand the relationships.",
          },
          prompt: {
            zh: "请为新手卖家讲清反向海淘的用户购买流程，重点解释 Weidian、淘宝、1688、店铺和代理平台之间的关系，并按用户实际发生的顺序拆解流程。",
            en: "Explain the reverse cross-border buyer journey for a new seller, especially the relationships among Weidian, Taobao, 1688, storefronts, and proxy platforms, in the actual order users experience them.",
          },
          capability: "",
        },
        {
          id: "seller-checkpoint",
          title: { zh: "做一次阶段理解自测", en: "Run a stage understanding check" },
          description: {
            zh: "用提问和追问检查自己现在到底理解到什么程度。",
            en: "Use questions and follow-ups to test how much you actually understand right now.",
          },
          prompt: {
            zh: "请作为卖家导师，对一个反向海淘新手做一次阶段理解自测。先问 5 个基础问题，再根据回答继续追问，最后指出他目前最缺的认知点和下一步建议。",
            en: "Act as a seller coach and run a stage understanding check for a reverse cross-border beginner. Ask 5 foundation questions, follow up based on the answers, and then point out the biggest gaps and the best next step.",
          },
          capability: "",
        },
      ],
      gates: [
        {
          id: "seller-basics",
          title: { zh: "开始认知反向海淘基本概念", en: "Learn the basic concept of AntiTao" },
          description: {
            zh: "先建立最基础的行业认知，知道反向海淘是什么、和普通跨境电商有什么不同，以及这门生意的基本角色。",
            en: "Build the minimum industry context first: what AntiTao is, how it differs from typical cross-border commerce, and the basic roles in the business.",
          },
          common_questions: [
            {
              zh: "反向海淘到底是什么，和普通跨境电商有什么区别？",
              en: "What exactly is AntiTao, and how is it different from regular cross-border e-commerce?",
            },
            {
              zh: "海外用户为什么会买中国平台上的商品？",
              en: "Why do overseas users buy products from Chinese platforms?",
            },
            {
              zh: "卖家、代理平台、海外买家分别获得什么价值？代理平台为什么主要收服务费而不是商品佣金？",
              en: "What value do sellers, platforms, proxies, and users each get from this business?",
            },
          ],
          pass_standard: {
            zh: "能用自己的话讲清反向海淘的基本定义、核心角色和基本赚钱逻辑。",
            en: "Can explain the basic definition, core roles, and monetization logic of AntiTao in their own words.",
          },
        },
        {
          id: "seller-journey",
          title: { zh: "认知用户购买流程和链路关系", en: "Understand the buyer journey and role relationships" },
          description: {
            zh: "不只是记住平台名字，而是真正理解用户如何从种草走到下单收货，以及各平台在链路中的作用。",
            en: "Move beyond memorizing platform names and truly understand how users move from discovery to purchase and delivery, and what each platform does in the chain.",
          },
          common_questions: [
            {
              zh: "一个海外用户到底是怎么从看到内容一路走到下单收货的？",
              en: "How does an overseas user actually move from seeing content to placing an order and receiving the package?",
            },
            {
              zh: "Weidian、淘宝、1688、店铺和代理平台分别在链路里做什么？",
              en: "What roles do Weidian, Taobao, 1688, storefronts, and proxy platforms each play in the chain?",
            },
            {
              zh: "用户到底是在平台里买，还是在店铺里买，还是在代理平台里买？",
              en: "Where is the actual purchase happening: on the platform, in the store, or through a proxy platform?",
            },
          ],
          pass_standard: {
            zh: "能用文字按顺序说清用户购买流程，并解释 Weidian、淘宝、1688、店铺和代理平台之间的关系。",
            en: "Can map the buyer journey and explain the relationships among Weidian, Taobao, 1688, storefronts, and proxy platforms.",
          },
        },
        {
          id: "seller-promotion",
          title: { zh: "开始理解海外推广与合作", en: "Start understanding overseas promotion and partnerships" },
          description: {
            zh: "开始知道如果想把货卖出去，通常会怎么和平台、网红、自有内容账号配合。",
            en: "Start understanding how sellers typically work with platforms, influencers, and their own content accounts to generate demand.",
          },
          common_questions: [
            {
              zh: "如果做海外推广，通常是和平台合作、和网红合作，还是自己做账号？",
              en: "For overseas promotion, do sellers usually work with platforms, influencers, or build their own accounts?",
            },
            {
              zh: "平台合作和网红合作的区别到底是什么？",
              en: "What is the actual difference between platform cooperation and influencer cooperation?",
            },
            {
              zh: "如果要自己做海外社交媒体账号，应该从哪里开始？",
              en: "If you want to build your own overseas social account, where should you start?",
            },
          ],
          pass_standard: {
            zh: "能分清平台合作、网红合作和自有账号三种推广路径，并知道自己该先从哪一种开始学。",
            en: "Can distinguish platform, influencer, and owned-account promotion paths and identify which one to learn first.",
          },
        },
        {
          id: "seller-review",
          title: { zh: "已经可以出单，学会复盘成果", en: "Once orders appear, learn to review results" },
          description: {
            zh: "重点不是只看有没有出单，而是学会看结果背后的原因，逐步形成自己的经营判断。",
            en: "The goal is not just to check whether orders happened, but to understand why they happened and build early business judgment.",
          },
          common_questions: [
            {
              zh: "已经出单了，我应该先看哪些数据和结果？",
              en: "Once orders happen, which results and data should I look at first?",
            },
            {
              zh: "怎么判断问题出在流量、转化、履约还是利润？",
              en: "How can I tell whether the problem is traffic, conversion, fulfillment, or profit?",
            },
            {
              zh: "一次做得不好，下一轮到底该改什么？",
              en: "If one round performs poorly, what exactly should I change next time?",
            },
          ],
          pass_standard: {
            zh: "能对一次卖家结果做基础复盘，并说出下一步最该优化的环节。",
            en: "Can run a basic seller review and identify the next area that most needs improvement.",
          },
        },
      ],
    },
    {
      id: "operator",
      badge: { zh: "运营通道", en: "Operator Track" },
      title: { zh: "新手平台运营从 0 到 1 学习路径", en: "New Platform Operator 0-to-1 Learning Path" },
      subtitle: {
        zh: "帮助新手平台运营先认知业务全貌，再逐步理解采购、仓储、系统、合作推广和经营模型。",
        en: "Help new platform operators understand the whole business first, then gradually learn procurement, warehousing, systems, partnerships, and operating models.",
      },
      summary: {
        zh: "这条路径不追求立刻把平台做大，而是先帮助用户真正看懂平台如何运转，知道每个环节为什么存在，以及运营动作背后的系统逻辑。",
        en: "This path does not try to scale a platform overnight. It first helps learners truly understand how the platform works and the system logic behind each operating action.",
      },
      outcome: {
        zh: "目标结果：用户开始像平台运营一样理解业务链路、后台流程、推广合作与经营模型。",
        en: "Target outcome: the learner starts to think like a platform operator across workflows, systems, partnerships, and business models.",
      },
      actions: [
        {
          id: "operator-basics",
          title: { zh: "先听懂平台运营在做什么", en: "Understand what platform ops actually do" },
          description: {
            zh: "从平台运营视角讲清行业结构、平台价值和日常工作重心。",
            en: "Explain the industry structure, platform value, and daily operating focus from the platform side.",
          },
          prompt: {
            zh: "请把反向海淘平台运营这份工作讲给一个完全不懂的新手听，重点解释平台在行业里提供什么价值、平台运营每天在关心什么，以及为什么平台运营不能只盯着流量。",
            en: "Explain reverse cross-border platform operations to a complete beginner, focusing on platform value, what operators care about daily, and why platform operations cannot focus on traffic alone.",
          },
          capability: "",
        },
        {
          id: "operator-flow",
          title: { zh: "讲清平台业务链路", en: "Explain the platform business flow" },
          description: {
            zh: "把用户、商品、采购、仓储、后台和推广放进一条完整链路里理解。",
            en: "Understand users, products, procurement, warehousing, backend systems, and promotion as one connected flow.",
          },
          prompt: {
            zh: "请从平台运营视角，讲清反向海淘的平台业务链路，覆盖用户购买流程、商品采购流程、仓库流程、后台系统流程，以及这些环节之间是怎么连接起来的。",
            en: "From the platform-operations perspective, explain the platform business chain in reverse cross-border commerce, covering the buyer flow, procurement flow, warehouse flow, backend workflow, and how they connect.",
          },
          capability: "",
        },
        {
          id: "operator-checkpoint",
          title: { zh: "做一次运营认知自测", en: "Run an operations understanding check" },
          description: {
            zh: "通过提问和追问，判断自己现在更缺流程认知、系统认知还是经营模型认知。",
            en: "Use guided questions to see whether your biggest gap is in workflows, systems, or operating models.",
          },
          prompt: {
            zh: "请作为平台运营导师，对一个反向海淘新手运营做一次认知自测。围绕用户流程、采购仓储、平台后台、达人合作、财务与风控模型各问一个问题，再根据回答判断他现在最缺的认知层。",
            en: "Act as a platform operations coach and run an understanding check for a reverse cross-border beginner. Ask one question each on user flow, procurement and warehouse flow, backend systems, influencer partnerships, and finance/risk models, then identify the biggest gap.",
          },
          capability: "",
        },
      ],
      gates: [
        {
          id: "operator-basics",
          title: { zh: "开始认知反向海淘基本概念", en: "Learn the basic concept of AntiTao" },
          description: {
            zh: "先建立平台运营看行业的视角，知道这门生意里有哪些核心角色和基本关系。",
            en: "First build an operator’s industry view and understand the core roles and relationships in the business.",
          },
          common_questions: [
            { zh: "反向海淘这个行业到底是怎么运转的？", en: "How does the AntiTao industry actually work?" },
            { zh: "平台运营和卖家视角最大的区别是什么？", en: "What is the biggest difference between the platform-ops view and the seller view?" },
            { zh: "平台在这门生意里真正提供的价值是什么？", en: "What real value does the platform provide in this business?" },
          ],
          pass_standard: {
            zh: "能讲清反向海淘的行业结构，以及平台在其中扮演的作用。",
            en: "Can explain the industry structure of AntiTao and the platform’s role in it.",
          },
        },
        {
          id: "operator-journey",
          title: { zh: "认知反向海淘的用户购买流程", en: "Understand the AntiTao buyer journey" },
          description: {
            zh: "平台运营不是只做后台，而是必须看懂用户从种草到下单的完整体验。",
            en: "Platform operators are not just back-office users; they must understand the full user experience from discovery to purchase.",
          },
          common_questions: [
            { zh: "用户从看到内容到下单收货的完整流程是什么？", en: "What is the complete flow from seeing content to receiving the order?" },
            { zh: "平台在哪些环节影响用户体验和转化？", en: "At which stages does the platform affect experience and conversion?" },
            { zh: "用户为什么会流失，常见卡点在哪里？", en: "Why do users drop off, and where are the usual friction points?" },
          ],
          pass_standard: {
            zh: "能说明用户购买流程，并指出平台影响体验和转化的关键节点。",
            en: "Can explain the buyer journey and identify the key platform-controlled experience and conversion points.",
          },
        },
        {
          id: "operator-ops-flow",
          title: { zh: "开始认知采购、仓库和后台流程", en: "Start understanding procurement, warehouse, and backend flows" },
          description: {
            zh: "开始把平台内部业务流串起来，理解商品、订单、仓库和系统之间的协同逻辑。",
            en: "Start connecting the platform’s internal workflow and understand how products, orders, warehouses, and systems coordinate.",
          },
          common_questions: [
            { zh: "商品是怎么进入平台体系的？", en: "How do products enter the platform system?" },
            { zh: "仓库、订单、上架、发货这些流程之间怎么衔接？", en: "How do warehousing, orders, listing, and shipping connect?" },
            { zh: "平台后台系统到底是为了解决什么问题？", en: "What problems is the platform backend system actually solving?" },
          ],
          pass_standard: {
            zh: "能讲清商品采购、仓储、订单和后台系统之间的基本业务流。",
            en: "Can explain the basic business flow among procurement, warehousing, orders, and backend systems.",
          },
        },
        {
          id: "operator-promotion",
          title: { zh: "开始认知网红与平台合作推广流程", en: "Start understanding influencer-platform promotion flows" },
          description: {
            zh: "理解平台增长为什么需要达人合作，以及合作流量如何被平台承接。",
            en: "Understand why platform growth depends on influencer cooperation and how that traffic is captured by the platform.",
          },
          common_questions: [
            { zh: "平台为什么要和网红合作，而不是只做站内运营？", en: "Why does a platform need influencer cooperation instead of only doing internal operations?" },
            { zh: "平台和达人合作的基本流程是什么？", en: "What is the basic workflow for platform-influencer cooperation?" },
            { zh: "推广合作怎么从曝光走到平台承接？", en: "How does a promotion partnership move from exposure into platform conversion?" },
          ],
          pass_standard: {
            zh: "能说清平台与网红合作推广的基本流程和承接逻辑。",
            en: "Can explain the basic flow and conversion logic of platform-influencer promotion.",
          },
        },
        {
          id: "operator-models",
          title: { zh: "开始认知财务、推广、支付封控和系统模型", en: "Start understanding finance, promotion, payment control, and system models" },
          description: {
            zh: "从执行动作进入模型认知，理解平台为什么必须同时关注增长、风险、利润和系统稳定。",
            en: "Move from task execution to model thinking and understand why platforms must balance growth, risk, profit, and system stability.",
          },
          common_questions: [
            { zh: "平台为什么不能只看订单和 GMV？", en: "Why can’t a platform focus only on orders and GMV?" },
            { zh: "财务模型、推广模型、支付封控模型、系统模型分别在管什么？", en: "What do the finance, promotion, payment control, and system models each govern?" },
            { zh: "平台增长和平台风险为什么总是绑在一起？", en: "Why are platform growth and platform risk always tied together?" },
          ],
          pass_standard: {
            zh: "能理解平台运营不是单点动作，而是多个经营模型同时协同。",
            en: "Can understand that platform operations are not isolated actions, but the coordination of multiple operating models.",
          },
        },
      ],
    },
  ],
};

export const ANTITAO_SYSTEM_BLOCKS: AntitaoSystemBlockDefinition[] = [
  {
    id: "knowledge",
    titleKey: "systemBlocks.knowledge.title",
    descriptionKey: "systemBlocks.knowledge.description",
    href: "/knowledge",
  },
  {
    id: "coaches",
    titleKey: "systemBlocks.coaches.title",
    descriptionKey: "systemBlocks.coaches.description",
    href: "/agents",
  },
  {
    id: "playbooks",
    titleKey: "systemBlocks.playbooks.title",
    descriptionKey: "systemBlocks.playbooks.description",
    href: "/book",
  },
];

export const ANTITAO_COACHES: AntitaoCoachDefinition[] = [
  {
    botId: "seller-launch-coach",
    trackId: "seller",
    titleKey: "coach.seller.title",
    descriptionKey: "coach.seller.description",
    focusKey: "coach.seller.focus",
  },
  {
    botId: "platform-ops-coach",
    trackId: "operator",
    titleKey: "coach.operator.title",
    descriptionKey: "coach.operator.description",
    focusKey: "coach.operator.focus",
  },
];

function localizeText(value: LocalizedText, language: string): string {
  if ((language || "zh").startsWith("zh")) return value.zh || value.en || "";
  return value.en || value.zh || "";
}

function toTrackMap(
  curriculum: AntitaoCurriculum,
  language: string,
): Record<AntitaoTrackId, AntitaoLocalizedTrackDefinition> {
  const localizedTracks = curriculum.tracks.map((track) => ({
    id: track.id,
    badge: localizeText(track.badge, language),
    title: localizeText(track.title, language),
    subtitle: localizeText(track.subtitle, language),
    summary: localizeText(track.summary, language),
    outcome: localizeText(track.outcome, language),
    gates: track.gates.map((gate) => ({
      id: gate.id,
      title: localizeText(gate.title, language),
      description: localizeText(gate.description, language),
      commonQuestions: gate.common_questions.map((question) =>
        localizeText(question, language),
      ),
      passStandard: localizeText(gate.pass_standard, language),
    })),
    actions: track.actions.map((action) => ({
      id: action.id,
      title: localizeText(action.title, language),
      description: localizeText(action.description, language),
      prompt: localizeText(action.prompt, language),
      capability: action.capability,
    })),
  }));

  const defaultLocalizedTracks = DEFAULT_ANTITAO_CURRICULUM.tracks.map((track) => ({
    id: track.id,
    badge: localizeText(track.badge, language),
    title: localizeText(track.title, language),
    subtitle: localizeText(track.subtitle, language),
    summary: localizeText(track.summary, language),
    outcome: localizeText(track.outcome, language),
    gates: track.gates.map((gate) => ({
      id: gate.id,
      title: localizeText(gate.title, language),
      description: localizeText(gate.description, language),
      commonQuestions: gate.common_questions.map((question) =>
        localizeText(question, language),
      ),
      passStandard: localizeText(gate.pass_standard, language),
    })),
    actions: track.actions.map((action) => ({
      id: action.id,
      title: localizeText(action.title, language),
      description: localizeText(action.description, language),
      prompt: localizeText(action.prompt, language),
      capability: action.capability,
    })),
  }));

  return {
    seller:
      localizedTracks.find(
        (track): track is AntitaoLocalizedTrackDefinition => track.id === "seller",
      ) || defaultLocalizedTracks.find((track) => track.id === "seller")!,
    operator:
      localizedTracks.find(
        (track): track is AntitaoLocalizedTrackDefinition => track.id === "operator",
      ) || defaultLocalizedTracks.find((track) => track.id === "operator")!,
  };
}

let curriculumCache: AntitaoCurriculum | null = null;

export async function fetchAntitaoCurriculum(): Promise<AntitaoCurriculum> {
  const response = await fetch(apiUrl("/api/v1/antitao-curriculum"), {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch AntiTao curriculum");
  }
  const payload = (await response.json()) as { curriculum?: AntitaoCurriculum };
  return payload.curriculum || DEFAULT_ANTITAO_CURRICULUM;
}

export function useAntitaoCurriculum(language: string) {
  const [curriculum, setCurriculum] = useState<AntitaoCurriculum>(
    curriculumCache || DEFAULT_ANTITAO_CURRICULUM,
  );
  const [loading, setLoading] = useState(curriculumCache === null);

  useEffect(() => {
    let cancelled = false;
    fetchAntitaoCurriculum()
      .then((data) => {
        curriculumCache = data;
        if (!cancelled) setCurriculum(data);
      })
      .catch(() => {
        if (!cancelled) setCurriculum(curriculumCache || DEFAULT_ANTITAO_CURRICULUM);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tracks = useMemo(() => toTrackMap(curriculum, language), [curriculum, language]);
  const trackList = useMemo(
    () => [tracks.seller, tracks.operator],
    [tracks],
  );

  return { curriculum, tracks, trackList, loading, setCurriculum };
}

export function normalizeAntitaoTrack(
  value: string | null | undefined,
): AntitaoTrackId {
  return value === "operator" ? "operator" : "seller";
}
