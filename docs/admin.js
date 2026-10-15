/* =========================================================================
 * docs/admin.js
 * 后台管理逻辑：在线维护个人信息、头像、简历、技能、项目与博客。
 * 所有数据保存到浏览器本地（IndexedDB + localStorage），不写死到代码中。
 * ========================================================================= */
(function () {
  'use strict';

  // ---------- 工具函数 ----------
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseTags(str) {
    return String(str || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // 全局提示
  var toastTimer = null;
  function toast(msg, type) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  // 读取 File 为 Blob（标准化，便于存入 IndexedDB）
  function readFileAsBlob(file) {
    return file.arrayBuffer().then(function (buf) {
      return new Blob([buf], { type: file.type || 'application/octet-stream' });
    });
  }
  function humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  // ---------- 状态 ----------
  var currentPanel = 'personal';
  var editingProjectId = null; // null = 新建
  var editingBlogId = null;
  var skillsCache = [];        // 技能内存副本
  var avatarObjectUrl = null;

  // ---------- 侧边栏切换 ----------
  function switchPanel(name) {
    currentPanel = name;
    document.querySelectorAll('.admin-sidebar .nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-panel') === name);
    });
    document.querySelectorAll('.admin-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + name);
    });
  }

  // =========================================================================
  // 1. 基本信息
  // =========================================================================
  function loadPersonal() {
    var p = SiteDB.getPersonal();
    document.getElementById('p-name').value = p.name || '';
    document.getElementById('p-bio').value = p.bio || '';
    document.getElementById('p-email').value = p.email || '';
    document.getElementById('p-location').value = p.location || '';
    document.getElementById('p-github').value = p.github || '';
    document.getElementById('p-website').value = p.website || '';
  }

  function renderAvatarPreview(avatarFile) {
    var preview = document.getElementById('avatar-preview');
    if (avatarObjectUrl) { URL.revokeObjectURL(avatarObjectUrl); avatarObjectUrl = null; }
    if (avatarFile && avatarFile.blob) {
      avatarObjectUrl = URL.createObjectURL(avatarFile.blob);
      preview.innerHTML = '<img src="' + avatarObjectUrl + '" alt="头像预览">';
    } else {
      preview.innerHTML = '<div class="placeholder">👤</div>';
    }
  }

  function renderResume(resumeFile) {
    var nameEl = document.getElementById('resume-name');
    var removeBtn = document.getElementById('resume-remove-btn');
    if (resumeFile && resumeFile.blob) {
      nameEl.textContent = resumeFile.name + '（' + humanSize(resumeFile.blob.size) + '）';
      removeBtn.style.display = '';
    } else {
      nameEl.textContent = '尚未上传简历';
      removeBtn.style.display = 'none';
    }
  }

  function savePersonal() {
    var info = {
      name: document.getElementById('p-name').value.trim(),
      bio: document.getElementById('p-bio').value.trim(),
      email: document.getElementById('p-email').value.trim(),
      location: document.getElementById('p-location').value.trim(),
      github: document.getElementById('p-github').value.trim(),
      website: document.getElementById('p-website').value.trim()
    };
    SiteDB.savePersonal(info);
    toast('基本信息已保存', 'success');
  }

  // 头像上传
  function setupAvatarUpload() {
    var input = document.getElementById('avatar-input');
    document.getElementById('avatar-upload-btn').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', async function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast('请选择图片文件', 'error'); return; }
      try {
        var blob = await readFileAsBlob(file);
        await SiteDB.saveFile('avatar', 'avatar', file.name, blob);
        renderAvatarPreview(await SiteDB.getFile('avatar'));
        toast('头像已上传并保存', 'success');
      } catch (e) { toast('头像上传失败', 'error'); }
      input.value = '';
    });
  }

  // 简历上传 / 删除
  function setupResume() {
    var input = document.getElementById('resume-input');
    document.getElementById('resume-upload-btn').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', async function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.type !== 'application/pdf') { toast('请选择 PDF 文件', 'error'); return; }
      try {
        var blob = await readFileAsBlob(file);
        await SiteDB.saveFile('resume', 'resume', file.name, blob);
        renderResume(await SiteDB.getFile('resume'));
        toast('简历 PDF 已上传', 'success');
      } catch (e) { toast('简历上传失败', 'error'); }
      input.value = '';
    });
    document.getElementById('resume-remove-btn').addEventListener('click', async function () {
      await SiteDB.deleteFile('resume');
      renderResume(null);
      toast('简历已删除', 'success');
    });
  }

  // =========================================================================
  // 2. 技能管理
  // =========================================================================
  function renderSkillsAdmin() {
    var list = document.getElementById('skills-admin-list');
    if (!skillsCache.length) {
      list.innerHTML = '<div class="list-empty">暂无技能，请在上方添加。</div>';
      return;
    }
    list.innerHTML = skillsCache.map(function (s, idx) {
      return '' +
        '<div class="skill-row" data-idx="' + idx + '">' +
          '<input type="text" class="name" value="' + esc(s.name) + '" placeholder="技能名称" />' +
          '<input type="range" class="lv" min="0" max="100" value="' + (Number(s.level) || 0) + '" />' +
          '<span class="lv-val">' + (Number(s.level) || 0) + '%</span>' +
          '<button class="btn btn-danger btn-sm del">删除</button>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.skill-row').forEach(function (row) {
      var idx = Number(row.getAttribute('data-idx'));
      var nameInput = row.querySelector('.name');
      var lvInput = row.querySelector('.lv');
      var lvVal = row.querySelector('.lv-val');

      nameInput.addEventListener('change', function () {
        skillsCache[idx].name = nameInput.value.trim();
        SiteDB.saveSkills(skillsCache);
        toast('技能已更新', 'success');
      });
      lvInput.addEventListener('input', function () {
        skillsCache[idx].level = Number(lvInput.value);
        lvVal.textContent = lvInput.value + '%';
        SiteDB.saveSkills(skillsCache);
      });
      row.querySelector('.del').addEventListener('click', function () {
        skillsCache.splice(idx, 1);
        SiteDB.saveSkills(skillsCache);
        renderSkillsAdmin();
        toast('技能已删除', 'success');
      });
    });
  }

  function setupSkills() {
    var levelInput = document.getElementById('skill-level');
    var levelVal = document.getElementById('skill-level-val');
    levelInput.addEventListener('input', function () { levelVal.textContent = levelInput.value; });

    document.getElementById('skill-add').addEventListener('click', function () {
      var name = document.getElementById('skill-name').value.trim();
      if (!name) { toast('请输入技能名称', 'error'); return; }
      skillsCache.push({ id: SiteDB.genId(), name: name, level: Number(levelInput.value) || 0 });
      SiteDB.saveSkills(skillsCache);
      document.getElementById('skill-name').value = '';
      renderSkillsAdmin();
      toast('技能已添加', 'success');
    });
  }

  // =========================================================================
  // 3. 项目 / 博客 编辑器（Markdown 分屏实时预览）
  // =========================================================================
  function bindMarkdownEditor(textarea, preview) {
    var timer = null;
    textarea.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(async function () {
        preview.innerHTML = await MDRender.render(textarea.value);
      }, 120);
    });
  }

  function showEditor(kind, show) {
    // kind: 'project' | 'blog'
    var listView = document.getElementById(kind === 'project' ? 'projects-list-view' : 'blogs-list-view');
    var editor = document.getElementById(kind === 'project' ? 'project-editor' : 'blog-editor');
    listView.style.display = show ? 'none' : '';
    editor.style.display = show ? '' : 'none';
  }

  // 项目列表
  function renderProjectsAdmin(projects) {
    var list = document.getElementById('projects-admin-list');
    if (!projects.length) {
      list.innerHTML = '<div class="list-empty">暂无项目，点击「新建项目」开始。</div>';
      return;
    }
    list.innerHTML = projects.map(function (p) {
      return '' +
        '<div class="list-item">' +
          '<div class="info">' +
            '<div class="title">' + esc(p.title) + '</div>' +
            '<div class="meta">更新于 ' + fmtDate(p.updatedAt) + (p.tags && p.tags.length ? ' · ' + esc(p.tags.join(' / ')) : '') + '</div>' +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn btn-ghost btn-sm edit">编辑</button>' +
            '<button class="btn btn-danger btn-sm del">删除</button>' +
          '</div>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.list-item').forEach(function (item, i) {
      var p = projects[i];
      item.querySelector('.edit').addEventListener('click', function () { openProjectEditor(p); });
      item.querySelector('.del').addEventListener('click', async function () {
        if (!confirm('确定删除项目「' + p.title + '」吗？')) return;
        await SiteDB.deleteProject(p.id);
        toast('项目已删除', 'success');
        renderProjectsAdmin(await SiteDB.getProjects());
      });
    });
  }

  function openProjectEditor(project) {
    editingProjectId = project ? project.id : null;
    document.getElementById('project-title').value = project ? (project.title || '') : '';
    document.getElementById('project-link').value = project ? (project.link || '') : '';
    document.getElementById('project-summary').value = project ? (project.summary || '') : '';
    document.getElementById('project-tags').value = project ? (project.tags || []).join(', ') : '';
    var md = project ? (project.content || '') : '# 项目标题\n\n在这里编写项目介绍 ...\n';
    var ta = document.getElementById('project-md');
    ta.value = md;
    document.getElementById('project-md-preview').innerHTML = '';
    showEditor('project', true);
    MDRender.render(md).then(function (html) {
      document.getElementById('project-md-preview').innerHTML = html;
    });
  }

  async function saveProject() {
    var title = document.getElementById('project-title').value.trim();
    if (!title) { toast('请输入项目标题', 'error'); return; }
    var project = {
      id: editingProjectId,
      title: title,
      link: document.getElementById('project-link').value.trim(),
      summary: document.getElementById('project-summary').value.trim(),
      tags: parseTags(document.getElementById('project-tags').value),
      content: document.getElementById('project-md').value
    };
    await SiteDB.saveProject(project);
    toast('项目已保存', 'success');
    showEditor('project', false);
    renderProjectsAdmin(await SiteDB.getProjects());
  }

  // 博客列表
  function renderBlogsAdmin(blogs) {
    var list = document.getElementById('blogs-admin-list');
    if (!blogs.length) {
      list.innerHTML = '<div class="list-empty">暂无博客，点击「新建博客」开始。</div>';
      return;
    }
    list.innerHTML = blogs.map(function (b) {
      return '' +
        '<div class="list-item">' +
          '<div class="info">' +
            '<div class="title">' + esc(b.title) + '</div>' +
            '<div class="meta">更新于 ' + fmtDate(b.updatedAt) + (b.tags && b.tags.length ? ' · ' + esc(b.tags.join(' / ')) : '') + '</div>' +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn btn-ghost btn-sm edit">编辑</button>' +
            '<button class="btn btn-danger btn-sm del">删除</button>' +
          '</div>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.list-item').forEach(function (item, i) {
      var b = blogs[i];
      item.querySelector('.edit').addEventListener('click', function () { openBlogEditor(b); });
      item.querySelector('.del').addEventListener('click', async function () {
        if (!confirm('确定删除博客「' + b.title + '」吗？')) return;
        await SiteDB.deleteBlog(b.id);
        toast('博客已删除', 'success');
        renderBlogsAdmin(await SiteDB.getBlogs());
      });
    });
  }

  function openBlogEditor(blog) {
    editingBlogId = blog ? blog.id : null;
    document.getElementById('blog-title').value = blog ? (blog.title || '') : '';
    document.getElementById('blog-summary').value = blog ? (blog.summary || '') : '';
    document.getElementById('blog-tags').value = blog ? (blog.tags || []).join(', ') : '';
    var md = blog ? (blog.content || '') : '# 文章标题\n\n在这里编写博客内容 ...\n';
    var ta = document.getElementById('blog-md');
    ta.value = md;
    document.getElementById('blog-md-preview').innerHTML = '';
    showEditor('blog', true);
    MDRender.render(md).then(function (html) {
      document.getElementById('blog-md-preview').innerHTML = html;
    });
  }

  async function saveBlog() {
    var title = document.getElementById('blog-title').value.trim();
    if (!title) { toast('请输入文章标题', 'error'); return; }
    var blog = {
      id: editingBlogId,
      title: title,
      summary: document.getElementById('blog-summary').value.trim(),
      tags: parseTags(document.getElementById('blog-tags').value),
      content: document.getElementById('blog-md').value
    };
    await SiteDB.saveBlog(blog);
    toast('博客已保存', 'success');
    showEditor('blog', false);
    renderBlogsAdmin(await SiteDB.getBlogs());
  }

  // =========================================================================
  // 初始化
  // =========================================================================
  function initParticles() {
    var canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var W, H, particles = [];
    var isMobile = window.innerWidth < 768;
    var count = isMobile ? 20 : 50;
    var colors = ['99,102,241', '139,92,246', '34,211,238', '236,72,153'];

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.4,
        c: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.c + ',0.7)';
        ctx.fill();
      }
      for (var a = 0; a < particles.length; a++) {
        for (var b = a + 1; b < particles.length; b++) {
          var pa = particles[a], pb = particles[b];
          var dx = pa.x - pb.x, dy = pa.y - pb.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.strokeStyle = 'rgba(139,92,246,' + (0.12 * (1 - dist / 120)) + ')';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  async function init() {
    initParticles();

    // 侧边栏
    document.querySelectorAll('.admin-sidebar .nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () { switchPanel(btn.getAttribute('data-panel')); });
    });

    // 基本信息
    loadPersonal();
    setupAvatarUpload();
    setupResume();
    document.getElementById('personal-save').addEventListener('click', savePersonal);

    // 技能
    skillsCache = SiteDB.getSkills();
    renderSkillsAdmin();
    setupSkills();

    // 项目
    document.getElementById('project-new').addEventListener('click', function () { openProjectEditor(null); });
    document.getElementById('project-save').addEventListener('click', saveProject);
    bindMarkdownEditor(document.getElementById('project-md'), document.getElementById('project-md-preview'));

    // 博客
    document.getElementById('blog-new').addEventListener('click', function () { openBlogEditor(null); });
    document.getElementById('blog-save').addEventListener('click', saveBlog);
    bindMarkdownEditor(document.getElementById('blog-md'), document.getElementById('blog-md-preview'));

    // 返回按钮（通用）
    document.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showEditor(btn.getAttribute('data-back'), false);
      });
    });

    // 初始化示例数据 + 读取文件
    await Seed.ensureSeed();

    var avatarFile = await SiteDB.getFile('avatar');
    renderAvatarPreview(avatarFile);
    renderResume(await SiteDB.getFile('resume'));
    renderProjectsAdmin(await SiteDB.getProjects());
    renderBlogsAdmin(await SiteDB.getBlogs());
  }

  init();
})();
