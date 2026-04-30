export type ReleaseNoteLocale = "zh" | "en";

export interface ReleaseNoteItem {
  title: Record<ReleaseNoteLocale, string>;
  description: Record<ReleaseNoteLocale, string>;
}

export interface ReleaseNote {
  version: string;
  date: string;
  label: Record<ReleaseNoteLocale, string>;
  headline: Record<ReleaseNoteLocale, string>;
  summary: Record<ReleaseNoteLocale, string>;
  highlights: ReleaseNoteItem[];
  details: ReleaseNoteItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "2026.04.29",
    date: "2026-04-29",
    label: {
      zh: "学习体验升级",
      en: "Learning Experience Upgrade",
    },
    headline: {
      zh: "学习地图、通关测试和 AI 导师更像一个完整的陪练系统了",
      en: "The learning map, mastery checks, and AI tutor now feel more like one coaching system.",
    },
    summary: {
      zh: "这次更新重点改善新手学习时的连续感：点节点更容易回到正确位置，通关测试更清楚，AI 导师对话也会按节点保留下来。",
      en: "This update improves learning continuity: node focus is clearer, mastery checks are easier to follow, and each node keeps its own tutor conversation.",
    },
    highlights: [
      {
        title: {
          zh: "手机打开通关手册不再露出桌面侧栏",
          en: "Mobile Pass Manual no longer shows the desktop sidebar",
        },
        description: {
          zh: "通关手册所在布局也适配了手机端，手机上会显示顶部横向导航，不再挤出左侧桌面菜单。",
          en: "The Pass Manual layout now adapts to mobile with the top horizontal nav instead of showing the desktop sidebar.",
        },
      },
      {
        title: {
          zh: "手机端新增横向节点缩略条",
          en: "Mobile now has a horizontal mini-node strip",
        },
        description: {
          zh: "节点详情打开后，电脑端用左侧竖向缩略条跳节点，手机端用顶部横向缩略条跳节点，符合各自的操作习惯。",
          en: "When node details are open, desktop uses a vertical mini-node rail, while mobile uses a horizontal mini-node strip for easier thumb navigation.",
        },
      },
      {
        title: {
          zh: "详情模式新增节点缩略导航",
          en: "Detail mode now has compact node navigation",
        },
        description: {
          zh: "打开右侧详情栏后，当前节点会在画布中居中放大，左侧新增竖向节点缩略条，方便快速跳到其他节点。",
          en: "When the right detail panel is open, the current node is centered and enlarged, with a vertical mini-node rail for quickly jumping to other nodes.",
        },
      },
      {
        title: {
          zh: "详情栏打开时也能切换节点资料",
          en: "Node resources now update while the detail panel is open",
        },
        description: {
          zh: "右侧节点详情栏打开后，再单击左侧其他节点，右侧标题、掌握标准和资源列表会一起切换。",
          en: "When the node detail panel is open, clicking another node on the map now updates the title, mastery criteria, and resource list together.",
        },
      },
      {
        title: {
          zh: "右侧资源会立即跟随节点切换",
          en: "Right-side resources now switch immediately with the selected node",
        },
        description: {
          zh: "在知识图谱里单击不同节点时，右侧资源卡会马上切换到对应节点的资料，不再停留在初始资源。",
          en: "Clicking different graph nodes now immediately updates the right-side resource cards instead of leaving them on the initial resources.",
        },
      },
      {
        title: {
          zh: "资源卡按设备分层展示",
          en: "Resource cards now adapt by device",
        },
        description: {
          zh: "电脑端恢复知识图谱左右两侧的完整资源文件卡；手机端改成顶部可横滑的资源缩略条，不再挤压图谱。",
          en: "Desktop restores the full left and right resource cards around the graph, while mobile shows a compact horizontal resource strip that does not crowd the map.",
        },
      },
      {
        title: {
          zh: "通关手册改成学习小抄",
          en: "Pass Manuals are now learning cheat sheets",
        },
        description: {
          zh: "通关手册不再是生成书的工具页，而是自动汇总已通关节点、AI 对话重点和复习资料，方便用户回头复习。",
          en: "Pass Manuals are no longer a book-generation workspace. They now summarize mastered nodes, AI tutor highlights, and review resources for easy revision.",
        },
      },
      {
        title: {
          zh: "公测导航更聚焦了",
          en: "Public beta navigation is more focused",
        },
        description: {
          zh: "先隐藏学习档案，保留知识来源和更新日志，并把反馈入口改成更口语的“你想说啥”。",
          en: "Learning Profile is hidden for now, Knowledge Sources and Release Notes stay visible, and Feedback is renamed to the more conversational Say Something.",
        },
      },
      {
        title: {
          zh: "手机端新增页面导航",
          en: "Mobile page navigation is now available",
        },
        description: {
          zh: "手机打开时顶部会出现横向导航，可以进入首页、知识来源、通关手册、你想说啥和更新日志。",
          en: "On phones, a horizontal navigation bar now lets users open the home graph, knowledge sources, playbook, Say Something, and release notes.",
        },
      },
      {
        title: {
          zh: "手机端学习图谱更容易用了",
          en: "The learning graph now works better on mobile",
        },
        description: {
          zh: "手机打开时会自动隐藏桌面侧边栏和外围资料卡，节点详情改成底部抽屉，顶部路径和 AI 导师也会按小屏幕重新排布。",
          en: "On phones, the desktop sidebar and outer resource cards are hidden, node details open as a bottom sheet, and the track controls and AI tutor adapt to small screens.",
        },
      },
      {
        title: {
          zh: "公测期 AI 功能暂时免登录",
          en: "AI features are temporarily open during public beta",
        },
        description: {
          zh: "测试用户现在可以不注册直接体验 AI 导师、节点讲解和通关测试。登录仍然用于长期保存个人学习进度。",
          en: "Public beta users can now try the AI tutor, node explanations, and mastery checks without signing in. Sign-in is still used for long-term progress saving.",
        },
      },
      {
        title: {
          zh: "新增真实用户反馈入口",
          en: "A real-user feedback entry is now available",
        },
        description: {
          zh: "左侧菜单新增“反馈入口”，测试用户可以直接写下哪里卡住、哪里有帮助、哪里想改，方便后续集中复盘。",
          en: "The sidebar now includes a Feedback entry where testers can share what confused them, what helped, and what should improve.",
        },
      },
      {
        title: {
          zh: "右侧资料会跟随当前节点切换",
          en: "Right-side files now follow the current node",
        },
        description: {
          zh: "在知识图谱里单击一个节点，右侧文件卡会立刻换成这个节点对应的资料；再点新的节点，也会同步切换。",
          en: "When you single-click a node in the knowledge graph, the right-side file cards switch to that node's resources. Clicking another node updates them again.",
        },
      },
      {
        title: {
          zh: "知识节点改成双击进入",
          en: "Knowledge nodes now open on double-click",
        },
        description: {
          zh: "单击节点只会把画面聚焦到该节点，方便浏览整张图谱；双击节点才打开右侧详情栏，避免误触后打断总览。",
          en: "Single-click now only focuses the node for browsing the map; double-click opens the right detail panel, reducing accidental interruptions.",
        },
      },
      {
        title: {
          zh: "知识图谱两侧新增资料文件卡",
          en: "Resource file cards now sit around the knowledge graph",
        },
        description: {
          zh: "未进入节点时，画布左右会展示“开始前必读”和“当前路径资料”文件卡，让页面不再显得空，也更像有资料可读的学习桌面。",
          en: "Before selecting a node, the graph now shows Start Here and Track Files cards on both sides, making the page feel less empty and more like a learning desk.",
        },
      },
      {
        title: {
          zh: "点开节点后资料会自动收进侧边栏",
          en: "Resources move into the side panel after selecting a node",
        },
        description: {
          zh: "进入某个节点后，外围文件卡会自动消失，用户只看到当前节点详情、资源、AI 导师和通关测试，学习焦点更集中。",
          en: "When a node is selected, the surrounding file cards disappear so the user can focus on the node details, resources, AI tutor, and mastery check.",
        },
      },
      {
        title: {
          zh: "知识图谱恢复为稳定版本",
          en: "The knowledge graph is back to the stable version",
        },
        description: {
          zh: "先撤回路线图式探索，恢复成原来的知识图谱卡片版，方便你先找真实用户评测，再决定是否改成行动路径。",
          en: "The roadmap-style experiment has been rolled back to the original knowledge-card graph, so it can be tested with real users before changing the core structure.",
        },
      },
      {
        title: {
          zh: "知识节点回到反淘基础学习结构",
          en: "Knowledge nodes are back to the AntiTao foundation structure",
        },
        description: {
          zh: "图谱内容恢复为反淘概念、角色关系、购买链路、流量、履约、推广、复盘和平台运营等知识节点。",
          en: "Graph content has been restored to AntiTao concepts, role relationships, purchase flow, traffic, fulfillment, promotion, review, and platform-ops nodes.",
        },
      },
      {
        title: {
          zh: "点击下一步会自动回到对应节点",
          en: "Next-step suggestions now refocus the right node",
        },
        description: {
          zh: "在通关测试结果里点击“先回到这个节点”或“建议进入这个节点”，学习地图会把对应节点移动到画布中央，并用高亮提醒你现在该看哪里。",
          en: "When you click a suggested next node in a mastery result, the map centers that node and highlights it so you know where to continue.",
        },
      },
      {
        title: {
          zh: "通关测试顶部信息固定显示",
          en: "Mastery check header stays visible",
        },
        description: {
          zh: "测试结果再长，也不会把“准备好了可以做一次通关测试”和按钮挤没了。顶部说明固定，结果内容单独滚动。",
          en: "Long results no longer push the test prompt and button away. The header stays fixed while the result area scrolls.",
        },
      },
      {
        title: {
          zh: "每个节点都会保留自己的 AI 导师对话",
          en: "Each node keeps its own AI tutor chat",
        },
        description: {
          zh: "你在某个知识节点里和 AI 导师聊过什么，会保存在这个节点下面。刷新页面或切换节点后再回来，也能继续接着看。",
          en: "Conversations with the AI tutor are saved per knowledge node, so you can return later and continue from the same context.",
        },
      },
      {
        title: {
          zh: "知识图谱变成默认首页",
          en: "The knowledge graph is now the default home page",
        },
        description: {
          zh: "打开系统后会直接进入学习图谱。未登录也可以看路径、点节点、读资料；只有使用 AI 导师和通关测试时才需要登录。",
          en: "Opening the app now takes users straight to the learning graph. Visitors can browse paths, nodes, and resources before signing in; AI tutor and mastery checks require login.",
        },
      },
      {
        title: {
          zh: "AI 导师入口更安静",
          en: "The AI tutor entry is less distracting",
        },
        description: {
          zh: "首页底部的 AI 导师改成居中半透明长条，并取消旧版底部留白，不再像白板一样遮住知识图谱；需要提问时点一下即可展开。",
          en: "The AI tutor entry on the home graph is now a centered translucent bar, with the old bottom spacer removed so the map remains visible behind it.",
        },
      },
      {
        title: {
          zh: "AI 导师会跟随画布居中",
          en: "The AI tutor stays centered in the canvas",
        },
        description: {
          zh: "左侧菜单折叠、展开，或右侧节点详情出现时，底部 AI 导师都会自动移动到当前知识图谱画布的正中间。",
          en: "When the sidebar collapses or the node detail panel opens, the bottom AI tutor bar now re-centers within the visible graph canvas.",
        },
      },
      {
        title: {
          zh: "AI 导师展开后也统一成首页风格",
          en: "The expanded AI tutor now matches the home graph style",
        },
        description: {
          zh: "打开 AI 导师后，弹层从粗边框卡通风改成柔和玻璃卡片，和知识图谱首页的浅色、细边框风格保持一致。",
          en: "The expanded AI tutor panel now uses the same soft glass-card, light, thin-border style as the knowledge graph home page.",
        },
      },
    ],
    details: [
      {
        title: {
          zh: "反淘基础概念口径更准确",
          en: "Core AntiTao concepts are more precise",
        },
        description: {
          zh: "把“平台”和“代理”收束为“代理平台”：代理平台主要通过代采、仓储、质检、合箱、国际物流和增值服务收费，一般不按商品佣金赚钱。",
          en: "The platform/agent concept is now unified as agent platform: it earns through purchasing, storage, QC, consolidation, international shipping, and value-added services, not usually product commission.",
        },
      },
      {
        title: {
          zh: "知识来源和学习图谱继续打通",
          en: "Knowledge sources and the learning graph are better connected",
        },
        description: {
          zh: "知识图谱节点、复习文档和 AI 导师建议之间的关系更清楚，用户更容易知道下一步该学哪个节点、先看哪篇资料。",
          en: "The relationship between graph nodes, review documents, and tutor suggestions is clearer, making the next learning step easier to find.",
        },
      },
      {
        title: {
          zh: "普通用户现在可以看到产品迭代日志",
          en: "Release notes are now visible to regular users",
        },
        description: {
          zh: "左侧菜单新增“更新了啥”，以后每次产品更新都会用普通用户能看懂的话记录下来。",
          en: "A Release Notes entry is now available in the sidebar, written in user-friendly language for future product updates.",
        },
      },
      {
        title: {
          zh: "更新日志默认只看最新内容",
          en: "Release notes show the newest updates first",
        },
        description: {
          zh: "“更新了啥”页面默认只展示最新 3 条更新；如果想看更早的内容，可以点击“查看更多更新”继续展开。",
          en: "The Release Notes page now shows only the latest three updates by default, with a load-more button for older entries.",
        },
      },
      {
        title: {
          zh: "更新日志标题更口语",
          en: "Release notes have a friendlier title",
        },
        description: {
          zh: "页面和左侧菜单都从“迭代日志”改成“更新了啥”，更像普通用户会主动点开的入口。",
          en: "The page and sidebar label now use a friendlier title, making product updates easier to recognize.",
        },
      },
      {
        title: {
          zh: "设置页新增注销登录",
          en: "Sign out is now available in Settings",
        },
        description: {
          zh: "如果想切换账号或退出当前登录状态，可以直接在左下角设置菜单里找到“注销登录”，不需要再绕到管理后台。",
          en: "You can now sign out directly from the bottom-left Settings menu when switching accounts or ending the current session.",
        },
      },
    ],
  },
];
