# 反淘淘金通关系统 - 使用指南 🎯

## 演示视频

<video src="assets/demo.mp4" controls width="100%"></video>

> 💡 如果视频无法播放，请[点击这里下载](assets/demo.mp4)或查看 [GitHub Releases](https://github.com/jackhyh123/-/releases) 中的演示视频。

---

## 快速开始

### 1. 环境准备

- Python 3.11+
- Node.js 20+
- （可选）Docker

### 2. 配置

```bash
# 复制配置文件
cp .env.example .env

# 编辑 .env，填入你的 LLM API Key
# LLM_BINDING=deepseek   # 或其他支持的 provider
# LLM_API_KEY=sk-xxx
# LLM_MODEL=deepseek-chat
```

### 3. 安装依赖

```bash
# Python 后端
pip install -e .

# 前端
cd web && npm install && cd ..
```

### 4. 启动

```bash
# 启动后端 (默认 8001 端口)
python -m deeptutor.api.run_server

# 启动前端 (默认 3000 端口)  
cd web && npm run dev
```

打开 http://localhost:3000 开始使用。

---

## 核心功能

### 📚 双轨课程体系
- **卖家轨**（Seller Lane）：跨境反向海淘卖家专属教程
- **运营轨**（Operator Lane）：平台运营通关指南

### 🧠 知识图谱
- 10 大知识节点，前置条件解锁
- 渐进式学习路径

### 🤖 AI 导师
- 每个课程节点配备专属 AI 导师
- 支持上下文对话、知识问答

### 📖 知识库
- 飞书 Wiki + Bitable 自动同步
- Obsidian 本地笔记无缝挂载
- RAG 增强的智能检索

### 🔐 会员系统
- 邮箱验证码登录
- 管理员后台

---

## 目录结构

```
├── deeptutor/          # Python 后端
│   ├── api/            # FastAPI 路由
│   ├── agents/         # AI Agent 引擎
│   ├── services/       # 核心服务
│   └── tutorbot/       # 导师机器人
├── web/                # Next.js 前端
│   ├── app/            # 页面路由
│   ├── components/     # UI 组件
│   └── locales/        # 国际化
├── starter_content/    # 课程种子内容
├── assets/             # 资源文件
└── data/               # 运行时数据（gitignore）
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI + Uvicorn |
| 前端框架 | Next.js 16 (Turbopack) |
| AI 引擎 | LlamaIndex RAG + Multi-Agent |
| 数据库 | SQLite |
| 嵌入模型 | OpenAI Compatible API |
| LLM | DeepSeek / OpenAI / LM Studio / Ollama |

---

## 致谢

本项目基于 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) 开源项目定制开发。

## 许可

[Apache 2.0](LICENSE)
