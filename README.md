# 个人展示网站（课程作业）

一个**纯前端**的个人展示网站，无需任何服务器与数据库。

- **前台**（`docs/index.html`）：展示头像、姓名、简介、技能、项目、博客，支持 Markdown 渲染与 PDF 简历下载。
- **后台**（`docs/admin.html`）：在线维护全部内容，内置 Markdown 分屏实时预览编辑器。
- **存储**：所有数据保存在浏览器本地（IndexedDB + localStorage）。

## 技术栈

- 原生 HTML / CSS / JavaScript（无框架、无构建工具）
- Markdown 解析：marked（本地打包，无 CDN 依赖）
- HTML 安全净化：DOMPurify（本地打包）
- 数据存储：IndexedDB + localStorage

## 目录结构

```
.
├── PRD.md            # 产品需求文档
├── TECH_DESIGN.md    # 技术设计文档
├── AGENTS.md         # 角色交互文档
├── README.md         # 本文件
├── .gitignore
└── docs/
    ├── index.html    # 前台展示页
    ├── admin.html    # 后台管理页
    ├── style.css     # 全局样式
    ├── app.js        # 前台逻辑
    ├── admin.js      # 后台逻辑
    └── data/
        ├── db.js          # 数据访问层（IndexedDB + localStorage）
        ├── markdown.js    # Markdown 渲染封装
        ├── seed.js        # 首次运行示例数据
        ├── marked.min.js  # Markdown 解析库
        └── purify.min.js  # HTML 净化库
```

## 本地运行

```powershell
cd 项目目录
python -m http.server 8000 --directory docs
```

- 前台：http://localhost:8000/index.html
- 后台：http://localhost:8000/admin.html

## 部署（Cloudflare Pages）

Build command 留空，Build output directory 填 `docs`。详见 `TECH_DESIGN.md`。

## 注意事项

后台录入的头像、简历 PDF、项目、博客等数据保存在**当前浏览器**的 IndexedDB / localStorage 中，不会随代码上传到 GitHub。部署上线后，需在线上后台（`admin.html`）重新录入信息。
