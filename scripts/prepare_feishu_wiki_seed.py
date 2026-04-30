"""Prepare a Feishu-wiki-ready seed package from the local AntiTao wiki.

This script does not call Feishu APIs. It converts the local Markdown wiki into
a teaching-oriented page tree that can be pasted into, imported into, or later
uploaded to Feishu Wiki.
"""

from __future__ import annotations

import argparse
import re
import shutil
from dataclasses import dataclass
from pathlib import Path


DEFAULT_WIKI_ROOT = Path("/Users/heyihui/wiki/wiki")
DEFAULT_OUTPUT_DIR = Path("data/feishu_wiki_seed")


@dataclass(frozen=True)
class WikiPage:
    section: str
    title: str
    source: str | None = None
    description: str = ""


PAGES: list[WikiPage] = [
    WikiPage("00_使用说明与索引", "00_反淘淘金通关系统知识库总览", None, "飞书知识库首页，说明学习顺序和目录。"),
    WikiPage("00_使用说明与索引", "01_知识库使用指南", "使用指南.md", "日常补充、查询、治理知识库的工作流。"),
    WikiPage("01_基础概念", "01_反向海淘是什么", "concepts/反向海淘.md", "系统级概念定义和术语约定。"),
    WikiPage("01_基础概念", "02_反向海淘不需要入驻_概念校准", "sources/反向海淘不需要入驻-概念校准.md", "纠正新手最容易混淆的入驻问题。"),
    WikiPage("01_基础概念", "03_QC图是什么", "concepts/qc-photos.md", "解释 QC 照片为什么是信任和售后的关键。"),
    WikiPage("01_基础概念", "04_集运与合箱", "concepts/consolidation.md", "解释多件商品入仓、合箱和国际转运。"),
    WikiPage("02_用户购买流程", "01_用户购买流程总览", None, "从发现商品到收货复购的完整用户旅程。"),
    WikiPage("02_用户购买流程", "02_订单_客服_售后流程", "concepts/客服SOP.md", "平台侧订单、支付、物流、售后处理方法。"),
    WikiPage("03_新手卖家学习路径", "01_卖家学习路径总览", None, "卖家从 0 到 1 的学习关卡。"),
    WikiPage("03_新手卖家学习路径", "02_反淘卖家的本质工作", "concepts/商家运营.md", "卖家真正要经营的是被发现、被信任和被复购。"),
    WikiPage("03_新手卖家学习路径", "03_Yupoo_微店_淘宝_1688关系", "concepts/商家运营.md", "解释商品展示、国内店铺和代理平台之间的关系。"),
    WikiPage("03_新手卖家学习路径", "04_海外推广与博主合作", "concepts/博主合作SOP.md", "卖家如何通过博主内容测品、种草和成交。"),
    WikiPage("03_新手卖家学习路径", "05_出单后的复盘指标", "concepts/关键指标体系.md", "出单后如何看结果，而不是只看有没有卖爆。"),
    WikiPage("04_平台运营学习路径", "01_运营学习路径总览", None, "平台运营从概念到系统模型的学习关卡。"),
    WikiPage("04_平台运营学习路径", "02_用户生态与社区运营", "concepts/用户生态.md", "解释为什么反淘平台必须做用户生态。"),
    WikiPage("04_平台运营学习路径", "03_商家与采购履约流程", "concepts/商家运营.md", "平台如何理解商品、供应商和用户购买心理。"),
    WikiPage("04_平台运营学习路径", "04_达人联盟与创作者管理", "concepts/达人联盟.md", "创作者入驻、推广归因、佣金结算和等级激励。"),
    WikiPage("04_平台运营学习路径", "05_客服_支付_风控流程", "concepts/客服SOP.md", "客服、支付异常、退款和风控工单协作。"),
    WikiPage("05_增长与渠道模型", "01_流量闭环", "concepts/流量闭环.md", "YouTube/Reddit/Discord/平台的转化闭环。"),
    WikiPage("05_增长与渠道模型", "02_KOL引流", "concepts/KOL引流.md", "大 KOL 冷启动与联盟计划规模化。"),
    WikiPage("05_增长与渠道模型", "03_Reddit运营", "concepts/Reddit运营.md", "Reddit 的真实语料价值、版块和发帖策略。"),
    WikiPage("05_增长与渠道模型", "04_私域运营", "concepts/私域运营.md", "Discord/Telegram 私域沉淀。"),
    WikiPage("05_增长与渠道模型", "05_UGC用户共创", "concepts/UGC用户共创.md", "让用户帮用户解决信息差。"),
    WikiPage("05_增长与渠道模型", "06_地区进入策略", "concepts/地区进入策略.md", "不同国家和地区的进入打法。"),
    WikiPage("06_财务与决策模型", "01_反向海淘财务模型", "concepts/反向海淘财务模型.md", "四本账和五层财务模型。"),
    WikiPage("06_财务与决策模型", "02_定价模型", "concepts/定价模型.md", "定价公式、地区加价倍率和调价触发条件。"),
    WikiPage("06_财务与决策模型", "03_关键指标体系", "concepts/关键指标体系.md", "CAC、ROI、注册率、下单率、复购率等基准。"),
    WikiPage("06_财务与决策模型", "04_决策判断库", "concepts/决策判断库.md", "博主合作、渠道投入、项目止损的判断框架。"),
    WikiPage("06_财务与决策模型", "05_三条底层心法", "principles/README.md", "倒过来想、安全边际、激励相容。"),
    WikiPage("07_案例库", "01_Pandabuy案例", "entities/platforms/Pandabuy.md", "反向海淘标杆案例。"),
    WikiPage("07_案例库", "02_Hoobuy案例", "entities/platforms/Hoobuy.md", "Pandabuy 继承者案例。"),
    WikiPage("07_案例库", "03_Superbuy案例", "entities/platforms/Superbuy.md", "老牌平台案例。"),
    WikiPage("07_案例库", "04_CNFans案例", "entities/platforms/CNFans.md", "同类平台案例。"),
    WikiPage("07_案例库", "05_Hubbuycn案例", "entities/platforms/Hubbuycn.md", "自营平台案例。"),
    WikiPage("08_产品与运营方案", "01_Hubbuy产品升级PRD摘要", "analyses/Hubbuy产品升级PRD摘要.md", "产品升级定位、抓手和判断。"),
    WikiPage("08_产品与运营方案", "02_AI智能客服需求文档", "analyses/AI智能客服需求文档.md", "AI 客服系统需求。"),
    WikiPage("08_产品与运营方案", "03_达人联盟入驻需求文档", "analyses/Hubbuy达人联盟入驻需求文档.md", "达人联盟入驻产品需求。"),
    WikiPage("08_产品与运营方案", "04_达人联盟物流GMV分佣系统", "analyses/Hubbuy达人联盟物流GMV分佣系统.md", "物流 GMV 分佣和等级升级规则。"),
    WikiPage("08_产品与运营方案", "05_新系统上线增长复盘", "analyses/Hubbuy新系统上线增长复盘.md", "上线活动、渠道和增长复盘。"),
    WikiPage("09_来源资料索引", "01_来源资料总表", None, "所有来源文档的索引。"),
]


GENERATED_PAGES: dict[str, str] = {
    "00_反淘淘金通关系统知识库总览": """# 反淘淘金通关系统知识库总览

这套知识库服务于“反淘淘金通关系统”：帮助新手卖家和新手平台运营，从 0 到 1 理解反向海淘，而不是承诺一夜卖爆或立刻把平台做起来。

## 这套知识库要解决什么

- 帮新手先校准概念：反淘不是 Temu/TikTok Shop 入驻，不是普通跨境电商开店。
- 帮卖家看懂自己真正要做的事：让商品被海外用户发现、理解、信任、购买和复购。
- 帮平台运营看懂系统：用户、商家、仓库、客服、支付、风控、创作者、财务模型如何互相影响。
- 帮 AI 导师回答得更准：回答必须优先引用本知识库，再做推理。

## 推荐学习顺序

1. 先读「01_基础概念」：搞清楚什么是反向海淘、为什么普通卖家不需要入驻。
2. 再读「02_用户购买流程」：知道海外用户如何从看到商品走到收货。
3. 卖家读「03_新手卖家学习路径」：建立商品展示、流量、博主合作和复盘能力。
4. 运营读「04_平台运营学习路径」：理解平台后台、仓库、达人、客服和风控。
5. 进阶读「05_增长与渠道模型」「06_财务与决策模型」。
6. 最后用「07_案例库」「08_产品与运营方案」做案例复盘。

## 管理原则

- 原文保留，结构重组。
- 先服务学习，再服务资料归档。
- 每个核心概念尽量有一句话定义、适用边界、常见误区和学习检查题。
- 高风险内容，如财务、合同、风控、支付、退款，只作为运营参考，不作为法律或财务建议。
""",
    "01_用户购买流程总览": """# 用户购买流程总览

反向海淘的用户购买流程，本质上是“海外用户想买中国平台上的商品，但自己无法顺畅完成采购、质检、合箱和国际转运，于是通过反淘平台完成中间流程”。

## 标准流程

1. 海外用户在 TikTok、Reddit、Discord、YouTube、Yupoo 或朋友推荐中看到商品。
2. 用户复制淘宝、微店、1688、闲鱼、Yupoo 或其他商品线索。
3. 用户进入反淘平台，粘贴链接或搜索商品。
4. 平台通过 API、链接解析、页面抓取或人工补录，生成海外用户可理解的商品页面。
5. 用户提交购买请求并支付商品费用。
6. 平台在国内完成代采，商品进入仓库。
7. 仓库拍摄 QC 图，用户确认商品是否符合预期。
8. 用户选择合箱、包装加固、物流线路并支付国际运费。
9. 平台发出国际包裹，用户等待收货。
10. 如出现异常，进入客服、退款、退货、补发或风控流程。

## 新手必须先懂的关系

| 角色 | 做什么 | 新手容易误解 |
| --- | --- | --- |
| 海外用户 | 提需求、下单、确认 QC、收货 | 以为用户直接在淘宝买 |
| 国内卖家 | 提供商品和国内店铺链接 | 以为必须入驻反淘平台 |
| 代理平台 | 代采、仓储、QC、合箱、国际物流、客服 | 以为只是一个展示网站，或误以为靠商品佣金赚钱 |
| 海外博主/社区 | 帮用户发现商品、建立信任 | 以为只是广告投放 |

## 一句话通关标准

能用文字按顺序说清“海外用户发现商品 → 代理平台代采 → 仓库 QC → 合箱转运 → 用户收货”的完整链路，并能说清楚国内卖家、代理平台和海外用户分别承担什么角色。
""",
    "01_卖家学习路径总览": """# 卖家学习路径总览

新手卖家的成长目标不是立刻卖爆，而是逐步形成“让商品被海外用户发现、理解、信任、购买和复购”的能力。

## 第 1 关：认知反向海淘基本概念

- 常见问题：反向海淘到底是什么？它和普通跨境电商有什么区别？我是不是要入驻平台？
- 通关标准：能用自己的话讲清楚反淘的定义、卖家/代理平台/海外买家三个核心角色和基本赚钱逻辑。

## 第 2 关：认知用户购买流程

- 常见问题：海外用户到底怎么买中国商品？Weidian、淘宝、1688、店铺和代理平台是什么关系？用户是在平台买还是在店铺买？
- 通关标准：能用文字按顺序说清用户购买流程，并解释 Weidian、淘宝、1688、店铺和代理平台之间的关系。

## 第 3 关：理解海外推广与合作

- 常见问题：我该去哪里找海外用户？怎么和平台或海外网红合作？我是否需要自己做海外社交媒体账号？
- 通关标准：能说出至少 2 条适合自己的获客路径，并知道每条路径的投入、风险和验证指标。

## 第 4 关：出单后复盘成果

- 常见问题：出单是不是代表能放大？没出单该看哪里？应该复盘流量、商品、价格还是履约？
- 通关标准：能基于曝光、点击、询盘、下单、复购和售后数据，判断下一步是继续、调整还是止损。
""",
    "01_运营学习路径总览": """# 运营学习路径总览

新手平台运营的成长目标，是从“知道反淘是什么”进阶到“能理解平台系统如何运转”，包括用户、商品、仓库、客服、达人、财务和风控。

## 第 1 关：认知反向海淘基本概念

- 常见问题：反淘平台到底解决什么问题？和传统跨境电商平台有什么不同？平台为什么能连接海外用户和中国货源？
- 通关标准：能讲清楚反淘平台的核心价值：代采、仓储、QC、合箱、国际转运和信任中介。

## 第 2 关：认知用户购买流程

- 常见问题：用户从哪里来？怎么提交商品？为什么要 QC？为什么要合箱？
- 通关标准：能完整描述用户从发现商品到收货的流程，并指出每一步可能流失的原因。

## 第 3 关：认知采购、仓库和后台流程

- 常见问题：采购、仓库、客服、物流分别负责什么？订单状态怎么流转？后台数据怎么和真实履约对应？
- 通关标准：能看懂一个订单从支付到签收的后台状态，并知道异常应该找哪个角色处理。

## 第 4 关：认知网红和平台合作推广流程

- 常见问题：达人合作怎么结算？怎么判断博主质量？为什么注册多不一定是好合作？
- 通关标准：能用注册、下单、留存、内容质量和异常信号判断一次合作是否有效。

## 第 5 关：认知平台模型

- 常见问题：平台怎么赚钱？现金流风险在哪里？支付风控、推广模型和系统模型如何互相影响？
- 通关标准：能用财务模型、推广模型、支付风控模型和系统模型解释一个平台增长动作是否值得做。
""",
    "01_来源资料总表": """# 来源资料总表

本页用于放所有来源文档的索引。来源资料不一定都适合新手直接阅读，但它们是概念页、模型页和案例页的证据基础。

## 来源使用原则

- 来源页回答“这个判断从哪里来”。
- 概念页回答“我们现在怎么理解它”。
- 学习路径回答“新手应该按什么顺序学”。
- 案例页回答“这个逻辑在真实平台上如何表现”。

## 建议后续维护方式

每次新增飞书文档、文章、周报、合同或聊天纪要时，先加入来源页，再决定是否更新概念页、模型页或案例页。
""",
}


def strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            return parts[2].lstrip()
    return text


def convert_obsidian_links(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        raw = match.group(1)
        if "|" in raw:
            return raw.split("|", 1)[1]
        return raw.rsplit("/", 1)[-1].replace(".md", "")

    return re.sub(r"\[\[([^\]]+)\]\]", repl, text)


def normalize_markdown(text: str) -> str:
    text = strip_frontmatter(text)
    text = convert_obsidian_links(text)
    text = text.replace("❌", "不建议：").replace("✅", "建议：")
    text = text.replace("🧠", "心法：")
    return text.strip() + "\n"


def read_page(wiki_root: Path, page: WikiPage) -> str:
    if page.source:
        source_path = wiki_root / page.source
        if not source_path.exists():
            return f"# {page.title}\n\n> 待补充：本地来源文件不存在：`{page.source}`。\n"
        body = normalize_markdown(source_path.read_text(encoding="utf-8"))
    else:
        body = GENERATED_PAGES.get(page.title, f"# {page.title}\n\n> 待补充。\n")

    source_line = f"\n\n---\n\n来源：本地知识库 `{page.source}`\n" if page.source else ""
    description = f"> 页面定位：{page.description}\n\n" if page.description else ""

    if body.lstrip().startswith("# "):
        first_newline = body.find("\n")
        if first_newline != -1:
            return body[: first_newline + 1] + "\n" + description + body[first_newline + 1 :].lstrip() + source_line

    return f"# {page.title}\n\n{description}{body}{source_line}"


def build_tree_markdown(pages: list[WikiPage]) -> str:
    grouped: dict[str, list[WikiPage]] = {}
    for page in pages:
        grouped.setdefault(page.section, []).append(page)

    lines = [
        "# 飞书知识库创建清单",
        "",
        "目标飞书知识库：反淘淘金通关系统知识库",
        "",
        "## 目录树",
        "",
    ]
    for section, section_pages in grouped.items():
        lines.append(f"### {section}")
        lines.append("")
        for page in section_pages:
            lines.append(f"- {page.title}：{page.description}")
        lines.append("")

    lines.extend(
        [
            "## 建议创建顺序",
            "",
            "1. 先创建 `00_使用说明与索引/00_反淘淘金通关系统知识库总览` 作为首页。",
            "2. 再创建 `01_基础概念` 和 `02_用户购买流程`，让 AI 导师先有正确概念边界。",
            "3. 然后创建卖家、运营两条学习路径。",
            "4. 最后补增长模型、财务模型、案例库和来源资料。",
            "",
            "## 生成说明",
            "",
            "这些页面来自本地 `/Users/heyihui/wiki/wiki`，已将 Obsidian 双链转换成普通文字，方便粘贴到飞书文档。",
        ]
    )
    return "\n".join(lines) + "\n"


def write_seed(wiki_root: Path, output_dir: Path) -> None:
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    (output_dir / "README.md").write_text(build_tree_markdown(PAGES), encoding="utf-8")

    for page in PAGES:
        section_dir = output_dir / page.section
        section_dir.mkdir(parents=True, exist_ok=True)
        content = read_page(wiki_root, page)
        (section_dir / f"{page.title}.md").write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare Feishu wiki seed pages from the local AntiTao wiki.")
    parser.add_argument("--wiki-root", type=Path, default=DEFAULT_WIKI_ROOT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    write_seed(args.wiki_root.expanduser(), args.output_dir)
    print(f"Generated Feishu wiki seed at: {args.output_dir}")


if __name__ == "__main__":
    main()
