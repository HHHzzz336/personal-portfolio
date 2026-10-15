# 技术设计文档（TECH_DESIGN）：个人展示网站

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.0 |
| 更新日期 | 2026-10-15 |

---

## 1. 技术选型

| 分类 | 技术 | 说明 |
| --- | --- | --- |
| 页面结构 | 原生 HTML5 | 语义化标签，前后台两个页面 |
| 样式 | 原生 CSS3 | CSS 变量 + Flexbox + Grid，响应式布局 |
| 交互逻辑 | 原生 JavaScript（ES6+） | 无框架、无构建工具，`<script>` 直接引用 |
| Markdown 解析库 | **marked**（本地打包 `marked.min.js`） | 把 Markdown 文本解析为 HTML |
| HTML 净化库 | **DOMPurify**（本地打包 `purify.min.js`） | 对渲染结果做 XSS 安全净化 |
| 数据存储 | **IndexedDB** + **localStorage** | 浏览器端存储，无需服务器数据库 |
| 部署平台 | Cloudflare Pages | 静态托管，输出目录为 `docs` |

> 说明：marked 与 DOMPurify 均以**本地文件**方式打包进 `docs/data/` 目录，站点运行时**不依赖任何 CDN 或外部网络请求**，保证离线与云端环境一致。

---

## 2. 目录结构

```
项目根目录
├── PRD.md
├── TECH_DESIGN.md
├── AGENTS.md
└── docs/
    ├── index.html
    ├── admin.html
    ├── style.css
    ├── app.js
    ├── admin.js
    └── data/
        ├── db.js          # 数据访问层
        ├── markdown.js    # Markdown 渲染封装
        ├── seed.js        # 示例数据（项目/博客 Markdown）
        ├── marked.min.js  # Markdown 解析库
        └── purify.min.js  # HTML 净化库
```

**脚本加载顺序**（`index.html` / `admin.html` 中）：

```
marked.min.js → purify.min.js → db.js → markdown.js → seed.js → app.js / admin.js
```

前四个为公共基础层（提供 `marked`、`DOMPurify`、`SiteDB`、`MDRender`、`Seed` 全局对象），最后一个是页面专属逻辑。

---

## 3. 数据存储方案

采用 **localStorage（轻量配置）+ IndexedDB（大文件 / 长文）** 的组合：

- localStorage：容量小、同步读写，适合个人基础信息、技能列表。
- IndexedDB：容量大、异步事务、支持 Blob，适合图片、PDF、Markdown 长文。

### 3.1 localStorage 结构

| Key | 类型 | 说明 |
| --- | --- | --- |
| `ps_personal` | Object | 个人基础信息（见下） |
| `ps_skills` | Array | 技能列表 |

**`ps_personal` 结构：**

```json
{
  "name": "姓名",
  "bio": "个人简介",
  "email": "邮箱",
  "location": "所在城市",
  "github": "GitHub 主页",
  "website": "个人网站"
}
```

**`ps_skills` 结构：**

```json
[
  { "id": "唯一id", "name": "技能名称", "level": 80 }
]
```

> `level` 为 0~100 的整数，前台以进度条展示。

### 3.2 IndexedDB 结构

数据库名：`personal_site_db`，版本：`1`。含三个对象仓库（keyPath 均为 `id`）：

| Object Store | 存储内容 | 记录结构 |
| --- | --- | --- |
| `files` | 头像图片、PDF 简历（Blob） | `{ id, type, name, blob, updatedAt }` |
| `projects` | 项目（含 Markdown 正文） | `{ id, title, summary, tags[], link, cover, content, createdAt, updatedAt }` |
| `blogs` | 博客（含 Markdown 正文） | `{ id, title, summary, tags[], content, createdAt, updatedAt }` |

**`files` 记录约定：**

| id | 含义 |
| --- | --- |
| `avatar` | 头像图片 Blob |
| `resume` | 简历 PDF Blob |

**`projects` / `blogs` 记录约定：**

- `content` 字段保存 Markdown 源码文本。
- `tags` 为字符串数组，后台用逗号分隔输入。
- `updatedAt` 用于列表排序（最新在前）。

### 3.3 数据访问层 API（docs/data/db.js）

对外暴露全局对象 `SiteDB`，核心方法：

```js
// 个人信息 / 技能
SiteDB.getPersonal() / SiteDB.savePersonal(obj)
SiteDB.getSkills()   / SiteDB.saveSkills(arr)

// 文件（头像 / 简历）
SiteDB.getFile(id) / SiteDB.saveFile(id, type, name, blob) / SiteDB.deleteFile(id)

// 项目
SiteDB.getProjects() / SiteDB.getProject(id)
SiteDB.saveProject(obj) / SiteDB.deleteProject(id)

// 博客
SiteDB.getBlogs() / SiteDB.getBlog(id)
SiteDB.saveBlog(obj) / SiteDB.deleteBlog(id)
```

### 3.4 首次运行示例数据（docs/data/seed.js）

`Seed.ensureSeed()` 在页面加载时调用：

- 项目 / 博客为空时，写入 2 条「示例项目」+ 2 条「示例博客」（Markdown 内容），便于首次打开即有内容。
- **个人信息与技能列表保持为空**，由管理员在后台录入，保证「不写死任何个人信息」。

---

## 4. Markdown 解析方案

`docs/data/markdown.js` 暴露 `MDRender.render(md)`：

```
Markdown 文本
  → marked.parse()          解析为 HTML
  → DOMPurify.sanitize()    安全净化（防 XSS，允许 target 属性）
  → 后处理：站外链接自动加 target="_blank" / rel="noopener"
  → 返回安全 HTML 字符串
```

- 前台（`app.js`）与后台（`admin.js`）统一调用该封装。
- 后台分屏编辑器在 `textarea` 的 `input` 事件上做 **120ms 防抖**后实时刷新预览。
- `render()` 返回 Promise，兼容 marked 同步 / 异步两种返回形式。

---

## 5. 前后台运行流程

### 5.1 前台（index.html + app.js）

```
加载页面 → 加载依赖脚本
  → Seed.ensureSeed()         初始化示例数据
  → SiteDB.getPersonal()      读取个人信息
  → SiteDB.getFile('avatar')  读取头像（Blob → ObjectURL）
  → SiteDB.getSkills()        读取技能
  → SiteDB.getProjects()      读取项目 → 渲染卡片
  → SiteDB.getBlogs()         读取博客 → 渲染卡片
  → SiteDB.getFile('resume')  读取简历 → 生成下载链接
```

### 5.2 后台（admin.html + admin.js）

```
加载页面 → 依赖脚本 → Seed.ensureSeed()
  → 侧边栏切换四个面板：基本信息 / 技能管理 / 项目管理 / 博客管理
  → 基本信息：头像上传(Blob→IndexedDB)、简历上传/删除、表单保存(localStorage)
  → 技能：增删改，实时保存(localStorage)
  → 项目/博客：列表 + Markdown 分屏编辑器，保存(IndexedDB)
```

### 5.3 文件上传链路

```
<input type="file"> → File → arrayBuffer() → Blob → SiteDB.saveFile() → IndexedDB
前台读取：SiteDB.getFile() → Blob → URL.createObjectURL() → <img> / <a download>
```

---

## 6. Cloudflare Pages 部署步骤

1. 将项目代码推送到 GitHub 仓库（详见 `AGENTS.md` 末尾操作步骤或作业说明）。
2. 登录 Cloudflare Dashboard → 左侧进入 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 授权并选择你的 GitHub 仓库。
4. 配置构建设置：

   | 配置项 | 值 |
   | --- | --- |
   | Production branch | `main`（或你的默认分支） |
   | Build command | 留空（纯静态，无需构建） |
   | Build output directory | `docs` |

5. 点击 **Save and Deploy**。
6. 部署完成后，访问 Cloudflare 分配的 `*.pages.dev` 域名即可查看。
7. 后续 `git push` 到该分支会自动触发重新部署。

> 因为仓库根目录下包含作业文档（PRD.md 等），所以必须把输出目录设为 `docs`，否则站点根路径会指向仓库根目录。

---

## 7. 关键设计决策

1. **不写死个人信息**：个人信息默认空，全部由后台录入到 localStorage；项目 / 博客仅预置“示例”数据。
2. **本地打包依赖**：marked / DOMPurify 以文件形式打包，避免运行时依赖 CDN。
3. **Blob 存 IndexedDB**：头像图片与 PDF 简历以 Blob 形式存储，读取后用 ObjectURL 展示 / 下载。
4. **安全渲染**：Markdown 渲染结果经过 DOMPurify 净化，外链强制新窗口打开并加 `noopener`。
