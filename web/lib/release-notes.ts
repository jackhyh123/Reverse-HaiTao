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
    version: "2026.05.01",
    date: "2026-05-01",
    label: {
      zh: "学习系统重大升级",
      en: "Learning System Major Upgrade",
    },
    headline: {
      zh: "从「知识浏览器」升级为完整的「教 → 练 → 测 → 改」学习系统",
      en: "Upgraded from a knowledge browser to a complete teach → practice → test → improve learning system.",
    },
    summary: {
      zh: "这次更新是 /learn 页面从 0 到 1 的重构：每个节点新增实操任务，AI 导师能感知你浏览过的资料，资源支持内联阅读，新增学习笔记、里程碑通知、连续学习天数和成就徽章。",
      en: "This update is a ground-up rebuild of the /learn page: every node now has a practical task, the AI tutor is aware of what you've read, resources open inline, and we've added study notes, milestone notifications, learning streaks, and achievement badges.",
    },
    highlights: [
      {
        title: {
          zh: "每个节点都有「实操任务」了",
          en: "Every node now has a practical task",
        },
        description: {
          zh: "每个知识节点新增实操任务 tab：左侧是任务描述和评估标准，右侧是提交框。写好答案后点「提交评估」，AI 会给打分（0-100）、综合评语、做得好的地方、还需要改进的地方和下一步建议。答案和评估结果会自动保存，切换节点回来还在。",
          en: "Each node now has a Practice tab with a task description, evaluation criteria, and a submission box. Submit your answer and the AI scores it (0-100), gives feedback, strengths, improvements, and a next step. Answers and results are auto-saved per node.",
        },
      },
      {
        title: {
          zh: "顶部新增路线导引条",
          en: "New roadmap guidance strip at the top",
        },
        description: {
          zh: "首页顶栏现在显示「第 X/14 步」、进度百分比和下一步要学的节点名。全部通关后会显示「🎉 全部通关！」并展示你已获得的能力。",
          en: "The top bar now shows your current step (X/14), progress percentage, and the next node to learn. When all nodes are mastered, it shows a celebration message and your acquired capabilities.",
        },
      },
      {
        title: {
          zh: "AI 导师能知道你浏览过哪些资料",
          en: "AI tutor is now aware of your reading history",
        },
        description: {
          zh: "在节点详情里点击资料链接，AI 导师会记住你看过什么。聊天时导师会主动引用：「你之前看过的那篇《xxx》里提到…」，让教学更自然、更个性化。",
          en: "When you click resource links in a node, the AI tutor remembers what you've read and can reference it during teaching: 'The article you read earlier mentioned...', making tutoring more natural and personalized.",
        },
      },
      {
        title: {
          zh: "资料支持内联阅读，不跳转飞书",
          en: "Resources now open inline instead of jumping to Feishu",
        },
        description: {
          zh: "点击资料链接会在当前页面弹出阅读面板，直接显示文档内容，不再跳转到飞书。想在新标签打开可以 Ctrl+点击。阅读面板顶部有「在飞书中打开」的快捷链接。",
          en: "Clicking a resource link now opens an inline reading panel with the document content, instead of jumping to Feishu. Ctrl+click still opens in a new tab. An 'Open in Feishu' shortcut is available in the panel header.",
        },
      },
      {
        title: {
          zh: "新增学习笔记",
          en: "Study notes are now available",
        },
        description: {
          zh: "在 AI 导师聊天区上方可以展开「学习笔记」面板，随时记录思考、心得或疑问。笔记自动保存到本地，也可以 Ctrl+Enter 一键保存到云端。切换节点后笔记各自独立。",
          en: "Above the AI tutor chat, you can expand the Study Notes panel to jot down thoughts, insights, or questions. Notes auto-save locally and can be saved to the cloud with Ctrl+Enter. Each node keeps its own notes.",
        },
      },
      {
        title: {
          zh: "里程碑通知：基础通关 / 赛道通关 / 全栈达人",
          en: "Milestone notifications for track completion",
        },
        description: {
          zh: "当你完成 6 个基础节点、卖家赛道 10 节点、运营赛道 10 节点或全部 14 节点时，右上角会弹出里程碑 toast 通知。已关闭的里程碑不会重复弹出。",
          en: "When you master all 6 foundation nodes, the full seller track (10 nodes), the full operator track (10 nodes), or all 14 nodes, a milestone toast appears at the top right. Dismissed milestones won't reappear.",
        },
      },
      {
        title: {
          zh: "连续学习天数 + 成就徽章",
          en: "Learning streak + achievement badges",
        },
        description: {
          zh: "顶栏显示 🔥 连续学习天数，点击徽章按钮可以打开徽章墙。8 个成就徽章等你解锁：入门学徒、基础达人、卖家专家、运营专家、三日坚持、周冠军、笔记达人、全部通关。新解锁的徽章会有弹出动画。",
          en: "The top bar shows your 🔥 learning streak, and clicking the badge button opens the badge wall. 8 achievements to unlock: Apprentice, Foundation Master, Seller Pro, Operator Pro, 3-Day Streak, Weekly Champion, Note Taker, and Completionist. New badges animate in.",
        },
      },
    ],
    details: [
      {
        title: {
          zh: "实操任务评估由 AI 实时判定",
          en: "Practical task evaluation is real-time AI-judged",
        },
        description: {
          zh: "后端新增 evaluate-task API，LLM 会对照每个节点预设的评估标准逐条判断，给出 0-100 分和通过/未通过判定，不是简单的关键词匹配。",
          en: "A new evaluate-task API uses the LLM to judge submissions against each node's preset evaluation criteria, producing a 0-100 score and pass/fail verdict — not just keyword matching.",
        },
      },
      {
        title: {
          zh: "资源阅读追踪通过 localStorage 实现",
          en: "Resource reading tracking uses localStorage",
        },
        description: {
          zh: "浏览记录保存在浏览器本地，不上传服务器。AI 导师只在你主动打开导师聊天时才会感知到浏览记录，用作教学引用的上下文。",
          en: "Reading history is stored locally in the browser and not uploaded to the server. The AI tutor only sees it when you actively open a tutor conversation, using it as teaching context.",
        },
      },
      {
        title: {
          zh: "学习数据全部本地优先",
          en: "All learning data is local-first",
        },
        description: {
          zh: "笔记、浏览记录、阅读进度、连续天数、徽章等数据优先保存在浏览器 localStorage 中。笔记支持手动「保存到云端」，用于跨设备同步。",
          en: "Notes, reading history, reading progress, streaks, and badges are all stored locally in localStorage first. Notes can be manually saved to the cloud for cross-device sync.",
        },
      },
      {
        title: {
          zh: "内联阅读仅支持飞书文档",
          en: "Inline reading only supports Feishu documents",
        },
        description: {
          zh: "出于安全考虑，内联阅读代理只允许抓取飞书域名（*.feishu.cn）的页面，文本截断至 8000 字符，带 15 秒超时保护。",
          en: "For security, the inline reading proxy only allows fetching from Feishu domains (*.feishu.cn), truncates content to 8,000 characters, and has a 15-second timeout.",
        },
      },
    ],
  },
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
