# Claude Code Viewer

Claude Code Viewer 是一个用于本地查看、分析和管理 Claude Code 交互日志的工具。它提供了一个现代化的 Web 界面，帮助开发者回顾与 Claude 的对话历史，分析 Token 使用情况，并对会话进行分类管理。

## ✨ 功能特性

- **👀 可视化日志查看**：以聊天界面的形式还原 Claude Code 的交互过程，支持 Markdown 渲染、代码高亮和工具调用展示。
- **📂 多项目/会话管理**：自动扫描日志目录，按项目和会话组织日志文件。
- **🔍 全文搜索**：快速搜索历史对话内容，定位关键信息。
- **📊 数据仪表盘**：概览项目统计信息、Token 消耗趋势等。
- **🏷️ 标签管理**：支持为会话添加自定义标签，便于分类和筛选。
- **⚙️ 灵活配置**：支持自定义日志扫描路径。
- **📦 一体化部署**：支持将前端资源打包进 Python 包，无需单独运行前端服务。

## 🛠️ 技术栈

- **后端**：Python 3.8+, FastAPI, Uvicorn, Click
- **前端**：React 19, TypeScript, Vite, Tailwind CSS, Recharts

## 🚀 安装与运行

### 方式一：一体化安装（推荐）

你可以将前端构建结果打包进 Python 包中，这样只需要启动一个服务即可。

1. **构建并安装**

   我们提供了一个构建脚本，会自动构建前端资源并打包 Python 包：

   ```bash
   # 运行构建脚本
   python build_package.py
   
   # 安装构建好的包 (在 dist/ 目录下)
   pip install dist/claude_viewer-0.1.0-py3-none-any.whl
   # 或者直接安装当前目录
   pip install .
   ```

2. **启动服务**

   ```bash
   claude-viewer serve
   ```

   访问 `http://127.0.0.1:8000` 即可直接使用完整功能（无需单独启动前端）。

### 方式二：开发模式

如果你需要修改代码，可以分别启动前后端。

#### 1. 后端服务

后端负责解析日志文件并提供 API 接口。

```bash
# 1. 在项目根目录下安装 Python 依赖
pip install -e .

# 2. 启动后端服务
claude-viewer serve --host 127.0.0.1 --port 8000
```

服务启动后，API 将运行在 `http://127.0.0.1:8000`。

#### 2. 前端界面

前端提供用户交互界面。

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

启动后，访问终端显示的地址（通常是 `http://localhost:5173`）即可使用。

## 📁 目录结构

```
claude-code-viewer/
├── claude_viewer/      # Python 后端源码
│   ├── main.py         # CLI 入口
│   ├── server.py       # FastAPI 服务
│   ├── parser.py       # 日志解析逻辑
│   ├── static/         # 前端构建产物 (构建后生成)
│   └── ...
├── frontend/           # React 前端源码
│   ├── src/
│   │   ├── components/ # UI 组件
│   │   ├── api.ts      # API 客户端
│   │   └── ...
│   └── ...
├── pyproject.toml      # Python 项目配置
├── build_package.py    # 构建脚本
└── README.md           # 项目说明文档
```

## 📝 配置说明

默认情况下，工具会尝试自动扫描常见的 Claude Code 日志路径。如果需要指定特定路径，可以在设置页面进行配置，或者通过环境变量 `CLAUDE_LOG_PATH` 指定。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！