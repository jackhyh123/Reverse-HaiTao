# /learn — 学习行动中心

## 1. 页面定位

`/learn` 是"反淘淘金通关系统"的核心学习页面，负责**所有行动和学习行为**。它承接 `/explore`（生态图谱，纯信息认知）的流量——用户在看懂生态后，通过 `?stage=` 参数跳转到此页面开始学习具体知识点。

### 与 /explore 的分工

| 职责 | `/explore` | `/learn` |
|------|-----------|----------|
| 信息展示 | ✅ 生态全局 | ❌ |
| 行动引导 | ❌ | ✅ 全部行动 |
| 学习知识点 | ❌ | ✅ |
| AI 诊断 | ❌ | ✅ |
| 进度追踪 | ❌ | ✅ |
| 资源阅读 | ❌ | ✅ |

---

## 2. 数据模型

### 2.1 核心类型 (定义在 `lib/knowledge-graph.ts`)

```typescript
interface KnowledgeGraph {
  version: number;
  tracks: GraphTrack[];   // 学习轨道（seller/operator）
  nodes: GraphNode[];     // 知识节点
}

interface GraphTrack {
  id: string;             // "seller" | "operator"
  label: LocalizedText;   // { zh: string, en: string }
  color: string;          // 轨道主题色
}

interface GraphNode {
  id: string;
  track_ids: string[];           // 所属轨道
  title: LocalizedText;
  summary: LocalizedText;
  tags: string[];                // 分类标签
  estimated_minutes: number;
  prerequisites: string[];       // 前置节点 ID
  validation_questions: LocalizedText[];
  mastery_criteria: LocalizedText;
  resources?: NodeResource[];    // 关联阅读资料
  position?: { x: number; y: number };
  practical_task?: PracticalTask;
}

interface NodeResource {
  type: "article" | "doc" | "video" | "link";
  title: LocalizedText;
  url: string;
  summary?: LocalizedText;
}
```

### 2.2 生态系统区域 (定义在 `lib/ecosystem.ts`)

4 个区域，节点通过 tags 自动归类：

| RegionId | 中文名 | 颜色 | 标签关键词 |
|----------|--------|------|-----------|
| `traffic` | 流量层 | `#0891b2` | traffic, discovery, funnel, channels, kol |
| `transaction` | 交易层 | `#7c3aed` | platforms, revenue |
| `fulfillment` | 履约层 | `#ea580c` | fulfillment, logistics |
| `infrastructure` | 基建层 | `#6b7280` | foundation, system, data, concept |

### 2.3 Stage → Region 映射

从 `/explore` 的 5 个阶段到 4 个生态区域：

```typescript
const STAGE_TO_REGION = {
  traffic_entry:    "traffic",
  trust_building:   "transaction",
  order_decision:   "transaction",
  fulfillment:      "fulfillment",
  content_loop:     "infrastructure",
};
```

`classifyNodeToRegion(node)` 根据 node.tags + title 关键词 + track_ids 将任意节点映射到区域。

---

## 3. 页面状态机

```
┌──────────────────────────────────────────────────────┐
│                   /learn 进入                         │
└──────────────────────┬───────────────────────────────┘
                       │
              ┌────────▼────────┐
              │ 诊断是否完成？    │
              └────┬────────┬───┘
                   │ No     │ Yes
         ┌─────────▼──┐   ┌─▼──────────┐
         │Diagnostic   │   │ 加载图谱    │
         │Overlay      │   │ + 进度      │
         │(全屏覆盖)    │   └─┬──────────┘
         └──┬──────┬───┘     │
            │      │         │
   完成诊断  │      │ 跳过    │
            │      │         │
            └──────┴─────────┘
                   │
         ┌─────────▼─────────┐
         │ 有 ?stage= 参数？  │
         └────┬──────────┬───┘
              │ Yes      │ No
    ┌─────────▼──┐   ┌──▼───────────┐
    │ 自动选中    │   │ 正常加载      │
    │ 对应区域    │   │ (无选中节点)  │
    │ 第一个节点  │   └──────────────┘
    └────────────┘
```

### 3.1 DiagnosticOverlay（诊断覆盖层）

- **触发条件**：`localStorage` 中没有 `learn_diagnostic_completed === "true"`
- **功能**：AI 导师通过 3-5 个选择题评估用户水平，生成个性化学习路线
- **两种入口**：
  - "开始诊断" → 进入 AI 问答流程
  - "跳过诊断，自由浏览" → 直接使用标准图谱
- **文件**：`components/learn/DiagnosticOverlay.tsx`

---

## 4. 页面布局结构

```
┌──────────────────────────────────────────────────────────┐
│ Top Bar (claymorphism)                                   │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 标题 | 进度徽章 | 🔥连续天数 | 成就勋章 | 重新诊断     │ │
│ │ [seller轨道] [operator轨道]          [Ecosystem|Graph] │ │
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ MobileProgressCard (仅移动端, 无选中节点时)                │
├──────────────────────────────────────────────────────────┤
│ WelcomeStrip (仅桌面端, 无选中节点时)                      │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 双轨道描述卡 | 进度导引 | 延伸阅读下拉                  │ │
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────┬───────────────────────────────┤
│ Main Area                │ Detail Panel                  │
│ ┌────────────────────┐   │ (选中节点时出现)               │
│ │                    │   │ ┌─────────────────────────┐  │
│ │  EcosystemView     │   │ │ NodeDetailPanel         │  │
│ │  (2x2 区域网格)    │   │ │ - 资源阅读 tab           │  │
│ │    或              │   │ │ - AI 导师 tab            │  │
│ │  KnowledgeMapFlow  │   │ │ - 实践练习 tab           │  │
│ │  (ReactFlow 图谱)  │   │ │ - 前置/后置节点导航      │  │
│ │                    │   │ └─────────────────────────┘  │
│ └────────────────────┘   │                              │
│                          │                              │
│ + NodeMiniRail           │                              │
│   (左侧编号导轨)          │                              │
│                          │                              │
│ + ResourceDesktop        │                              │
│   (浮动资源卡,           │                              │
│    无选中节点时)          │                              │
└──────────────────────────┴───────────────────────────────┘
│ InlineResourceReader (资源阅读抽屉)                        │
│ FloatingAITutor (AI导师长条, 固定在底部)                    │
│ MilestoneToast (里程碑通知)                                │
└──────────────────────────────────────────────────────────┘
```

---

## 5. 组件树

```
LearnPage
├── DiagnosticOverlay          # 初诊覆盖层 (条件渲染)
├── [Loading Spinner]          # 加载状态
├── [Error Banner]             # 错误提示
├── Top Bar                    # 内联 JSX
│   ├── 标题 + 副标题
│   ├── 连续学习天数徽章
│   ├── 进度徽章 (已掌握/总数)
│   ├── AchievementBadges      # 成就徽章系统
│   ├── 诊断等级标签
│   ├── 重置进度按钮
│   └── 重新诊断按钮
├── Track Selector Pills       # 内联 JSX
│   └── ViewToggle             # 生态系统/图谱视图切换
├── MobileProgressCard         # 移动端进度卡片
├── WelcomeStrip               # 桌面端欢迎条
├── Main Layout (flex)
│   ├── EcosystemView          # 生态视图 (默认)
│   │   ├── EcosystemRegion ×4 # 4个区域卡片
│   │   │   └── EcosystemCard  # 单个知识节点卡片
│   │   └── EcosystemConnections # SVG 跨区域连线
│   ├── KnowledgeMapFlow       # 图谱视图 (ReactFlow)
│   │   ├── MapNodeView        # 自定义节点渲染
│   │   └── AnnotationNodeView # 便签节点渲染
│   ├── NodeMiniRail           # 左侧编号导轨 (有选中节点时)
│   └── ResourceDesktop        # 浮动资源卡 (无选中节点时)
│       └── ResourceStack ×2   # 左右资源堆栈
├── Detail Panel               # 节点详情面板 (条件渲染)
│   └── NodeDetailPanel
│       ├── Tab: 资源阅读
│       ├── Tab: AI 导师
│       └── Tab: 实践练习
├── InlineResourceReader       # 内嵌资源阅读器
├── FloatingAITutor            # 底部 AI 导师长条
└── MilestoneToast ×N          # 里程碑通知
```

---

## 6. 核心交互流程

### 6.1 节点选择流程

```
用户点击节点 (EcosystemView / KnowledgeMapFlow)
  → setPreviewNode(node)  // 预览状态
  → setSelectedNode(node) // 打开详情面板
  → requestNodeFocus(node.id) // 通知图谱视图聚焦
```

### 6.2 掌握判定流程

```
用户在 NodeDetailPanel 点击"标记已掌握"
  → upsertProgress API 写入后端
  → handleMarkMastered() → reload()
  → 重新拉取图谱 + 进度
  → detectMilestones() 检查是否触发里程碑
```

### 6.3 ?stage= 参数流程

```
/learn?stage=traffic_entry
  → useSearchParams() 读取 stage
  → STAGE_TO_REGION 映射到 "traffic" 区域
  → 图谱加载完成后
  → classifyNodeToRegion() 筛选该区域的所有节点
  → 优先选中第一个"未掌握"节点
  → 打开详情面板
```

### 6.4 资源阅读流程

```
点击资源链接
  → handleOpenResource(url, title)
  → InlineResourceReader 弹出
  → 资源内链点击 → push 到 breadcrumbStack
  → 面包屑返回 → pop breadcrumbStack
```

### 6.5 移动端抽屉手势

```
触摸拖拽手柄向下 > 100px → 关闭详情面板
触摸拖拽 < 100px → 弹回原位
使用 ref 避免 setState 导致的卡顿
```

---

## 7. 关键状态变量

| 变量 | 类型 | 说明 |
|------|------|------|
| `graph` | `KnowledgeGraph \| null` | API 返回的原始图谱 |
| `personalizedGraph` | `KnowledgeGraph \| null` | AI 诊断后的个性化图谱 |
| `activeGraph` | `KnowledgeGraph \| null` | 实际使用的图谱 (personalizedGraph \|\| graph) |
| `trackId` | `string` | 当前选中的轨道 ("seller" \| "operator") |
| `activeTrackId` | `string` | 实际使用的轨道 ID |
| `masteredIds` | `Set<string>` | 已掌握节点 ID 集合 |
| `selectedNode` | `GraphNode \| null` | 当前选中节点 (打开详情面板) |
| `previewNode` | `GraphNode \| null` | 预览/悬停节点 |
| `viewMode` | `"ecosystem" \| "graph"` | 视图模式 (持久化到 localStorage) |
| `diagnosticCompleted` | `boolean` | 是否完成诊断 |
| `diagnosticResult` | `object \| null` | 诊断结果 |
| `readerUrl` | `string \| null` | 当前阅读资源 URL |
| `focusedRegion` | `string \| null` | ?stage= 参数映射的目标区域 |
| `stageAppliedRef` | `Ref<boolean>` | stage 参数是否已应用 (防重复) |

---

## 8. API 依赖

| API 端点 | 用途 | 调用时机 |
|----------|------|----------|
| `GET /api/v1/knowledge-graph` | 获取知识图谱 | 页面加载 |
| `GET /api/v1/knowledge-graph/my-progress` | 获取学习进度 | 页面加载 |
| `POST /api/v1/knowledge-graph/progress` | 标记节点掌握 | 用户标记掌握时 |
| `POST /api/v1/knowledge-graph/reset-progress` | 重置进度 | 用户确认重置时 |
| `POST /api/v1/knowledge-graph/diagnostic-quiz` | AI 诊断问答 | DiagnosticOverlay 中 |
| `POST /api/v1/knowledge-graph/tutor` | AI 导师对话 | NodeDetailPanel tutor tab |
| `POST /api/v1/knowledge-graph/check-mastery` | 掌握度检查 | 实践练习提交时 |
| `POST /api/v1/knowledge-graph/evaluate-task` | 实践任务评估 | 实践练习提交时 |

---

## 9. 本地存储键

| Key | 用途 |
|-----|------|
| `learn-view-mode` | 视图模式持久化 |
| `learn_diagnostic_completed` | 诊断是否完成 |
| `learn_diagnostic_result` | 诊断结果 JSON |
| `learning-streak` | 连续学习天数 |

---

## 10. 文件清单

```
web/app/(utility)/learn/
  page.tsx                    # 主页面 (801行)
  README.md                   # 本文档

web/components/learn/
  AchievementBadges.tsx        # 成就徽章
  DiagnosticOverlay.tsx        # AI 诊断覆盖层
  DocumentAIPanel.tsx          # 文档 AI 面板
  EcosystemCard.tsx            # 生态卡片 (单个节点)
  EcosystemConnections.tsx     # SVG 跨区域连线
  EcosystemRegion.tsx          # 生态区域容器
  EcosystemView.tsx            # 生态视图 (2x2网格)
  FloatingAITutor.tsx          # 底部 AI 导师长条
  InlineResourceReader.tsx     # 内嵌资源阅读器
  KnowledgeMapFlow.tsx         # ReactFlow 知识图谱
  MilestoneNotification.tsx    # 里程碑通知
  MobileProgressCard.tsx       # 移动端进度卡片
  NodeDetailPanel.tsx          # 节点详情面板 (资源/导师/练习)
  NodeMiniRail.tsx             # 桌面端节点编号导轨 + 移动端节点条
  ResourceDesktop.tsx          # 桌面端浮动资源卡片
  ViewToggle.tsx               # 生态/图谱视图切换
  WelcomeStrip.tsx             # 桌面端欢迎条 (轨道选择+进度+资源)

web/lib/
  knowledge-graph.ts           # 图谱数据模型 + API 调用
  ecosystem.ts                 # 生态系统区域定义 + 节点分类 + 连接关系
  ecosystem-data.ts            # 生态系统共享数据 (阶段/子模块定义)
  graph-customization.ts       # 图谱自定义 (用户节点/边/便签)
  learning-streak.ts           # 学习连续天数
  useIsMobile.ts               # 移动端检测 Hook
```

---

## 11. 已知问题 & 改进方向

1. **`focusedRegion` 未传递给 `EcosystemView`**：`?stage=` 参数会设置 `focusedRegion` 状态并自动选中节点，但 `EcosystemView` 没有接收 `focusedRegion` prop 来做视觉高亮。当前通过选中节点间接实现。

2. **桌面端初次加载时图谱节点不居中**：`KnowledgeMapFlow` 在无选中节点时已改为 `fitView` 全节点适配，但需要实际验证刷新后效果。

3. **`editMode` 仅收 "添加节点/便签" 按钮被移除**：桌面端仍使用 `editMode={!isMobile}`，保留了拖拽、连线、删除功能，但无法通过 UI 添加新节点。`KnowledgeMapFlow` 中的 `handleAddNode` 和 `handleAddAnnotation` 保留但不可达（死代码）。

4. **诊断跳过逻辑简化**：`handleSkipDiagnostic` 仅设置 localStorage 标记，未保存完整的诊断结果。这意味着跳过诊断的用户不会看到 `diagnosticResult.level_label`。

5. **移动端 `NodeMiniStrip` 已提取但未在 page.tsx 中使用**：当前移动端使用 `NodeMiniRail` 即可，`NodeMiniStrip` 保留备用。

6. **`FloatingAITutor` 的 `leftOffsetPx` / `rightOffsetPx` 硬编码**：侧边栏宽度 60px/220px 和详情面板 480px 是魔法数字，与 UtilitySidebar 的实际尺寸耦合。

7. **图谱布局算法单一**：公共节点使用简单垂直骨架布局（`x: -nodeW/2, y: index * (nodeH + gap)`），未考虑更智能的 dagre 或力导向布局。
