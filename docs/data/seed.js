/* =========================================================================
 * docs/data/seed.js
 * 首次运行的模拟种子数据（仅项目 / 博客示例 Markdown）。
 * 注意：个人信息（姓名、简介、头像）与技能列表不在此预置，
 *       全部由管理员在后台页面录入，符合“不写死个人信息”的要求。
 * ========================================================================= */
(function (global) {
  'use strict';

  // 示例项目（可在后台删除 / 编辑）
  var SAMPLE_PROJECTS = [
    {
      id: 'proj-demo-1',
      title: '示例项目：纯前端个人展示网站',
      summary: '一个使用原生 HTML/CSS/JS 与 IndexedDB 构建的个人展示网站，无需服务器即可运行。',
      tags: ['HTML', 'CSS', 'JavaScript', 'IndexedDB'],
      link: '',
      cover: '',
      content: [
        '# 纯前端个人展示网站',
        '',
        '## 项目简介',
        '',
        '这是一个完全运行在浏览器端的个人展示网站，所有数据（头像、简历、项目、博客）都存储在 **IndexedDB** 与 **localStorage** 中，无需任何后端服务器。',
        '',
        '## 核心功能',
        '',
        '- 展示头像、姓名、个人简介与技能列表',
        '- 项目 / 博客内容由 **Markdown** 渲染',
        '- 支持 **PDF 简历** 下载',
        '- 后台管理页面可在线维护全部内容',
        '',
        '## 技术栈',
        '',
        '| 分类 | 技术 |',
        '| --- | --- |',
        '| 页面 | HTML5 + CSS3 |',
        '| 逻辑 | 原生 JavaScript (ES6+) |',
        '| 存储 | IndexedDB + localStorage |',
        '| 渲染 | Markdown 解析 |',
        '',
        '> 本条目为后台“示例数据”，可随时在管理后台删除或修改。'
      ].join('\n'),
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2
    },
    {
      id: 'proj-demo-2',
      title: '示例项目：Markdown 分屏编辑器',
      summary: '左侧编写 Markdown 源码、右侧实时预览渲染效果，数据保存在浏览器本地。',
      tags: ['JavaScript', 'Markdown', 'UI'],
      link: '',
      cover: '',
      content: [
        '# Markdown 分屏编辑器',
        '',
        '## 功能亮点',
        '',
        '1. 左侧编辑区实时输入 Markdown 源码',
        '2. 右侧预览区**即时渲染**最终效果',
        '3. 支持 `代码块`、*斜体*、**粗体**、~~删除线~~',
        '4. 内容一键保存为 Markdown 数据',
        '',
        '## 代码示例',
        '',
        '```js',
        "console.log('Hello, Markdown!');",
        '```',
        '',
        '> 编辑体验即所见即所得（WYSIWYG 的 Markdown 变体）。'
      ].join('\n'),
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000
    }
  ];

  // 示例博客（可在后台删除 / 编辑）
  var SAMPLE_BLOGS = [
    {
      id: 'blog-demo-1',
      title: '示例文章：如何用纯前端技术搭建个人网站',
      summary: '从零开始，只用 HTML/CSS/JS 与浏览器存储，快速上线一个个人展示站。',
      tags: ['教程', '前端'],
      content: [
        '# 如何用纯前端技术搭建个人网站',
        '',
        '## 为什么选择纯前端？',
        '',
        '纯前端方案**零服务器成本**，部署到 Cloudflare Pages 等静态托管平台即可访问，适合个人展示、作品集与课程作业。',
        '',
        '## 三个关键点',
        '',
        '1. 内容与展示分离：页面只负责渲染，数据放在浏览器本地',
        '2. 使用 Markdown 管理长文内容，写作体验友好',
        '3. 后台页面直接在线维护，无需改代码',
        '',
        '## 小结',
        '',
        '> 掌握 HTML/CSS/JS 与浏览器存储，就能做出一个功能完整的个人网站。'
      ].join('\n'),
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 5
    },
    {
      id: 'blog-demo-2',
      title: '示例文章：IndexedDB 入门指南',
      summary: '了解浏览器端结构化存储 IndexedDB 的基本用法，以及它和 localStorage 的区别。',
      tags: ['教程', '浏览器存储'],
      content: [
        '# IndexedDB 入门指南',
        '',
        '## IndexedDB 与 localStorage 的区别',
        '',
        '| 特性 | localStorage | IndexedDB |',
        '| --- | --- | --- |',
        '| 数据类型 | 字符串 | 任意对象 / Blob |',
        '| 容量 | 约 5MB | 数百 MB 起 |',
        '| 操作方式 | 同步 | 异步（事务） |',
        '',
        '## 适用场景',
        '',
        '- 小量配置用 **localStorage**',
        '- 图片、PDF、长文等大文件用 **IndexedDB**',
        '',
        '## 示例',
        '',
        '```js',
        'const req = indexedDB.open("db", 1);',
        'req.onsuccess = () => console.log("打开成功");',
        '```'
      ].join('\n'),
      createdAt: Date.now() - 86400000 * 7,
      updatedAt: Date.now() - 86400000 * 7
    }
  ];

  /**
   * 首次运行时初始化数据：
   * - 个人信息 / 技能列表若为空，保持为空（等待后台录入），不写入任何占位个人信息
   * - 项目 / 博客若为空，写入示例数据（便于首次打开即有内容可看）
   */
  async function ensureSeed() {
    try {
      var projects = await global.SiteDB.getProjects();
      if (!projects || projects.length === 0) {
        for (var i = 0; i < SAMPLE_PROJECTS.length; i++) {
          await global.SiteDB.saveProject(SAMPLE_PROJECTS[i]);
        }
      }
      var blogs = await global.SiteDB.getBlogs();
      if (!blogs || blogs.length === 0) {
        for (var j = 0; j < SAMPLE_BLOGS.length; j++) {
          await global.SiteDB.saveBlog(SAMPLE_BLOGS[j]);
        }
      }
    } catch (e) {
      if (global.console) console.error('初始化示例数据失败：', e);
    }
  }

  global.Seed = { ensureSeed: ensureSeed };
})(window);
