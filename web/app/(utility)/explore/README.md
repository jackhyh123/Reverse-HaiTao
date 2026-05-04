# 生态图谱 `/explore`

## 产品定位

**信息聚合 + 初步认知页面**。这个页面不是行动中心，不负责让用户执行任务。它的作用是让用户快速理解反淘生态如何运作。

```
3 秒看懂主流程
10 秒理解当前阶段
点击后进入学习中心深入
```

核心原则：
- 看懂生态 → `/explore`（本页）
- 学习执行 → `/learn`（学习行动中心）
- 所有 CTA 统一为 `去学习：XXX`

---

## 双状态设计

页面根据用户是否点击了节点，呈现两种状态：

### Overview State：生态总览态（默认）

触发条件：`expandedId === null`

页面首次进入时默认显示。一个横向铺开的 Overview Panel，帮助用户在点击任何节点之前先理解全局结构。

```
┌──────────────────────────────────────────────┐
│ 生态总览                                      │
│ 先看懂全局，再进入具体阶段                       │
│                                              │
│ 反淘生态是一个从内容触达到信任建立、再到交易履约  │
│ 和内容回流的完整链路。                           │
│                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ 看懂主链路 │ │ 理解三类角色│ │ 找到学习入口│       │
│ └──────────┘ └──────────┘ └──────────┘       │
│                                              │
│ 点击上方任一阶段，查看该阶段详情                  │
│ [阶段色 chips 可点击跳转]                       │
│                                              │
│ [进入学习中心]    或点击上方任一阶段...           │
└──────────────────────────────────────────────┘
```

Hover 节点时，底部提示动态更新为「点击查看「XXX」阶段详情」。

### Detail State：阶段详情态

触发条件：`expandedId !== null`

用户点击节点后进入。左侧展开阶段详情（子模块 + 关联知识点），右侧显示辅助说明面板。

```
┌──────────────────────────────────────┬────────────┐
│ Current Stage Panel                  │ Side Note  │
│ 当前阶段展开说明                       │ 阶段本质    │
│ 2×2 子模块卡片                        │ 生态位置    │
│ 关联知识点 chips                      │ 核心构成    │
│                                      │ 相关知识点   │
│                                      │            │
│                                      │ 去学习：XXX  │
└──────────────────────────────────────┴────────────┘
```

---

## 组件树

```
ExplorePage ("use client")
├── Header
│   ├── 标题 "反淘生态图谱" + 离线模式徽章
│   ├── 副标题描述
│   └── PerspectiveSwitcher（买家/平台/卖家）
│
└── Main Content
    ├── Loading Spinner
    │
    ├── FlowBar（横向滚动，5 个节点 + 箭头连接）
    │   └── FlowNode × 5（选中/非选中双态视觉）
    │       ├── 左侧色条（选中 4px 主色 / 非选中 3px muted）
    │       ├── 图标 + 标题（选中加粗 / 非选中降权）
    │       ├── 生态层级标签
    │       ├── 3 条抽象认知关键词（视角联动）
    │       └── 展开/收起按钮
    │
    └── Bottom Area（双状态切换）
        │
        ├── [expandedId === null] OverviewPanel
        │   ├── 标题 + 说明
        │   ├── 3 个认知卡片（看懂主链路 / 理解三类角色 / 找到学习入口）
        │   ├── 5 个阶段色 chips（可点击跳转）
        │   └── 进入学习中心 CTA
        │
        └── [expandedId !== null] Detail Layout (flex-row)
            ├── ExpandPanel（flex-1）
            │   ├── 阶段标题 + 视角描述
            │   ├── SubModuleCard × N（2 列网格）
            │   └── 关联知识点 Chips
            │
            └── RightInsightPanel（240px，muted 背景降权）
                ├── 当前阶段标题
                ├── 阶段本质（一句话）
                ├── 生态位置（上游 → 层级 → 下游）
                ├── 核心构成（3 条抽象关键词）
                ├── 相关知识点 Chips
                └── 去学习：{当前阶段}
```

---

## 数据模型

### FlowStageDef

```typescript
interface FlowStageDef {
  id: FlowStageId;            // 5 阶段 ID
  title: { zh; en };
  iconName: string;
  color: string;              // 主题色
  bgColor: string;            // 背景色
  region: { zh; color };      // 所属生态层级（流量层/交易层/履约层/基建层）
  essence: { zh; en };        // 阶段本质一句话
  ecosystemPosition: {        // 生态位置
    layer: { zh; color };
    upstream?: { zh };        // 上游阶段
    downstream?: { zh };      // 下游阶段
  };
  perspectives: Record<Perspective, {
    bullets: string[];         // 3 条抽象认知关键词
    description: string;       // 视角描述
  }>;
  subModules: SubModuleDef[];
}
```

### SubModuleDef

```typescript
interface SubModuleDef {
  id: string;
  title: { zh; en };
  what: { zh; en };          // 是什么
  why: { zh; en };           // 为什么重要
  actionLabel: { zh; en };   // 去学习：XXX
}
```

### ClassificationResult

```typescript
interface ClassificationResult {
  stage: FlowStageId | null;
  confidence: "high" | "medium" | "low" | "fallback";
  matchedBy: string | null;  // 匹配到的关键词组或 fallback 方法名
}
```

---

## 5 阶段 × 4 层级映射

| 阶段 | 生态层级 | 颜色 | 阶段本质 |
|------|---------|------|---------|
| 流量入口 | 流量层 | `#0891b2` cyan | 商品信息如何跨越国界触达海外买家 |
| 信任建立 | 交易层 | `#10b981` green | 如何在没有实物接触的情况下建立信任 |
| 下单决策 | 交易层 | `#f59e0b` amber | 通过什么经济模型完成跨境购买决策 |
| 履约系统 | 履约层 | `#ea580c` orange | 商品从中国到海外买家的物理链条 |
| 内容回流 | 基建层 | `#8b5cf6` violet | 分享行为如何转化为新一轮流量 |

---

## 阶段分类逻辑

`classifyToStage(node)` → `ClassificationResult`

1. **关键词匹配**（6 组中英文正则）→ `confidence: "high"` + `matchedBy: "<关键词组名>"`
2. **Region 回退**：调用 `classifyNodeToRegion()` → `confidence: "fallback"` + `matchedBy: "region fallback: <region>"`
3. **无匹配**：`confidence: "low"` + `matchedBy: null`

---

## 视觉设计原则

### 视觉层级

```
一级焦点：顶部 5 阶段 FlowBar + 当前选中节点
二级焦点：中间展开内容 / Overview Panel
三级焦点：右侧辅助说明面板
```

### 节点双态

| 属性 | 选中态 | 非选中态 |
|------|--------|---------|
| 背景 | `var(--card)` 白 | `var(--muted)` 米灰 |
| 边框 | 2.5px 主色 | 2px `var(--border)` |
| 阴影 | 光晕（主色 + inner glow） | 无 |
| 透明度 | 1 | 0.78 |
| 左侧色条 | 4px 主色 | 3px `var(--border)` |
| 标题 | bold + foreground | medium + muted-foreground |
| 图标 | 主色背景 | 透明 |

### 颜色规则

- 阶段色只用于：左侧色条、当前节点边框、小标签、少量 icon 背景
- 大面积卡片、按钮不使用阶段色
- 右侧面板使用 muted 背景 + 与背景同色边框（视觉隐身）

### 阴影规则

- Flow 当前节点：中等阴影
- 非当前节点：无阴影
- 展开面板：轻阴影（clay-card 默认）
- SubModuleCard：无阴影
- 右侧面板：无阴影

### 字体层级

```
页面标题：28-32px / bold
副标题：14-16px / regular
流程节点标题：18px / semibold → 13px medium（非选中）
节点 bullet：13px
展开区标题：24px / bold
子模块标题：18px / semibold
正文说明：14-15px
右侧标题：18px / semibold
右侧正文：13-14px
辅助说明：12px
```

### 间距参考

```
Header → FlowBar：32-40px
FlowBar → 内容区：28-36px
展开区内部 padding：24-28px
子模块卡片 gap：16-20px
展开区 ↔ 右侧面板 gap：28px（lg:gap-7）
右侧内部 section gap：12-16px
```

---

## 视角切换语义

三视角切换改变的是"如何理解同一个生态环节"，不是"不同身份如何执行任务"。

| 视角 | 语义 |
|------|------|
| 买家 | 这个环节对我意味着什么 |
| 平台 | 这个环节在生态系统中扮演什么角色 |
| 卖家 | 这个环节对我的生意有什么意义 |

---

## 响应式

| 断点 | 布局 |
|------|------|
| 移动 `<768px` | 纵向堆叠，Overview Panel / Detail 全宽，右侧面板在展开面板下方 |
| 平板 `768-1023px` | 纵向堆叠，子模块 2 列 |
| 桌面 `≥1024px` | 横向并排，FlowBar 横向滚动，Overview Panel 全宽铺开 |

---

## 关键文件

| 文件 | 用途 |
|------|------|
| `web/app/(utility)/explore/page.tsx` | 页面全部实现（~1200 行，单文件） |
| `web/app/(utility)/explore/README.md` | 本架构文档 |
| `web/app/globals.css` | 设计系统、主题变量、Claymorphism 组件、动画 |
| `web/lib/ecosystem.ts` | 生态四层定义和节点分类 |
| `web/lib/knowledge-graph.ts` | `fetchGraph()` API 和 `GraphNode` 类型 |
