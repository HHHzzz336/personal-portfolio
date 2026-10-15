/* =========================================================================
 * docs/app.js
 * 前台逻辑：读取浏览器本地数据并渲染个人展示主页。
 * 所有数据均来自后台录入（IndexedDB + localStorage），无任何硬编码个人信息。
 * ========================================================================= */
(function () {
  'use strict';

  // 简单 HTML 转义，防止用户输入注入
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // 图标
  var ICONS = {
    email: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v.01L12 12l8-5.99V6H4zm16 12V8.5l-8 5.99-8-5.99V18h16z"/></svg>',
    location: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>',
    github: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.81c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg>',
    website: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.93 9h-3.06a15.9 15.9 0 0 0-1.23-5.57A8 8 0 0 1 19.93 11zM12 4c.83 1.2 1.48 2.53 1.91 4H10.1c.43-1.47 1.08-2.8 1.9-4zM4.07 13a8 8 0 0 1 0-2h3.14a16.6 16.6 0 0 0 0 2H4.07zm1.3 2h3.06c.29 1.98.72 3.86 1.23 5.57A8 8 0 0 1 5.37 15zM12 20c-.83-1.2-1.48-2.53-1.91-4h3.82c-.43 1.47-1.08 2.8-1.91 4zm2.64-6H9.36c-.1-.65-.15-1.32-.15-2s.05-1.35.15-2h5.28c.1.65.15 1.32.15 2s-.05 1.35-.15 2zm.7 5.57c.51-1.71.94-3.59 1.23-5.57h3.06A8 8 0 0 1 15.34 19.57zM17.7 12h3.14a8 8 0 0 0 0-2h-3.14a16.6 16.6 0 0 1 0 2z"/></svg>'
  };

  // 弹窗引用
  var modal = document.getElementById('modal');
  var modalClose = document.getElementById('modal-close');
  var modalTitle = document.getElementById('modal-title');
  var modalMeta = document.getElementById('modal-meta');
  var modalBody = document.getElementById('modal-body');

  var avatarUrl = null;

  // ---------- Hero 渲染 ----------
  function renderHero(personal, avatarFile) {
    var name = (personal.name || '').trim();
    var bio = personal.bio || '';
    var avatarEl = document.getElementById('hero-avatar');
    var nameEl = document.getElementById('hero-name');
    var bioEl = document.getElementById('hero-bio');
    var metaEl = document.getElementById('hero-meta');

    // 头像
    if (avatarFile && avatarFile.blob) {
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      avatarUrl = URL.createObjectURL(avatarFile.blob);
      avatarEl.innerHTML = '<img src="' + avatarUrl + '" alt="头像">';
    } else {
      var letter = name ? esc(name.charAt(0).toUpperCase()) : '&#128100;';
      avatarEl.innerHTML = '<div class="avatar-placeholder">' + letter + '</div>';
    }

    // 姓名 / 简介
    nameEl.textContent = name || '欢迎访问我的主页';
    bioEl.textContent = bio || '还没有填写个人简介，请前往后台管理页面录入。';

    // 联系方式 chips
    var chips = [];
    if (personal.email) chips.push({ icon: ICONS.email, text: personal.email, href: 'mailto:' + personal.email });
    if (personal.location) chips.push({ icon: ICONS.location, text: personal.location, href: null });
    if (personal.github) chips.push({ icon: ICONS.github, text: personal.github, href: personal.github });
    if (personal.website) chips.push({ icon: ICONS.website, text: personal.website, href: personal.website });

    if (chips.length) {
      metaEl.innerHTML = chips.map(function (c) {
        var inner = c.icon + '<span>' + esc(c.text) + '</span>';
        return c.href
          ? '<a class="chip" href="' + esc(c.href) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>'
          : '<span class="chip">' + inner + '</span>';
      }).join('');
    } else {
      metaEl.innerHTML = '';
    }
  }

  // ---------- 技能渲染 ----------
  function renderSkills(skills) {
    var el = document.getElementById('skills-list');
    if (!skills || !skills.length) {
      el.innerHTML = '<div class="empty"><div class="icon">&#127919;</div>暂无技能，请在后台录入。</div>';
      return;
    }
    el.innerHTML = skills.map(function (s) {
      var level = Math.max(0, Math.min(100, Number(s.level) || 0));
      return '' +
        '<div class="skill-card">' +
          '<div class="top"><span class="name">' + esc(s.name) + '</span><span class="level">' + level + '%</span></div>' +
          '<div class="bar"><span style="width:' + level + '%"></span></div>' +
        '</div>';
    }).join('');
  }

  // ---------- 卡片列表（项目 / 博客共用） ----------
  function renderCards(list, el, opts) {
    if (!list || !list.length) {
      el.innerHTML = '<div class="empty"><div class="icon">&#128193;</div>' + opts.emptyText + '</div>';
      return;
    }
    el.innerHTML = list.map(function (item) {
      var tags = (item.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
      return '' +
        '<div class="card" data-id="' + esc(item.id) + '" data-kind="' + opts.kind + '">' +
          '<h3>' + esc(item.title) + '</h3>' +
          (item.summary ? '<p class="summary">' + esc(item.summary) + '</p>' : '') +
          (tags ? '<div class="tags">' + tags + '</div>' : '') +
          '<span class="more">' + opts.moreText + ' &rarr;</span>' +
        '</div>';
    }).join('');

    el.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('click', function () {
        openDetail(card.getAttribute('data-id'), card.getAttribute('data-kind'));
      });
    });
  }

  function renderProjects(projects) {
    renderCards(projects, document.getElementById('projects-list'), {
      kind: 'project', emptyText: '暂无项目，请在后台录入。', moreText: '查看项目详情'
    });
  }

  function renderBlogs(blogs) {
    renderCards(blogs, document.getElementById('blog-list'), {
      kind: 'blog', emptyText: '暂无博客，请在后台录入。', moreText: '阅读全文'
    });
  }

  // ---------- 详情弹窗 ----------
  async function openDetail(id, kind) {
    var item = kind === 'project' ? await SiteDB.getProject(id) : await SiteDB.getBlog(id);
    if (!item) return;
    modalTitle.textContent = item.title || '';
    modalMeta.textContent = (item.tags && item.tags.length ? item.tags.join(' · ') + ' ｜ ' : '') + fmtDate(item.updatedAt);
    modalBody.innerHTML = await MDRender.render(item.content || '');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ---------- 简历下载 ----------
  async function setupResumeDownload() {
    var btn = document.getElementById('resume-btn');
    var resume = await SiteDB.getFile('resume');
    if (resume && resume.blob) {
      var url = URL.createObjectURL(resume.blob);
      btn.href = url;
      btn.setAttribute('download', resume.name || 'resume.pdf');
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  }

  // ---------- 粒子星空背景 ----------
  function initParticles() {
    var canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var W, H, particles = [];
    var isMobile = window.innerWidth < 768;
    var count = isMobile ? 28 : 70;
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
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.4,
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
        ctx.fillStyle = 'rgba(' + p.c + ',0.75)';
        ctx.fill();
      }
      for (var a = 0; a < particles.length; a++) {
        for (var b = a + 1; b < particles.length; b++) {
          var pa = particles[a], pb = particles[b];
          var dx = pa.x - pb.x, dy = pa.y - pb.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.strokeStyle = 'rgba(139,92,246,' + (0.13 * (1 - dist / 130)) + ')';
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

  // ---------- 滚动进入动画 ----------
  function initReveal() {
    if (!('IntersectionObserver' in window)) return;
    document.body.classList.add('js-anim');
    var targets = document.querySelectorAll('.card, .skill-card, .section-head');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    targets.forEach(function (el) { observer.observe(el); });
  }

  // ---------- 初始化 ----------
  async function init() {
    document.getElementById('footer-year').textContent = new Date().getFullYear();
    initParticles();

    await Seed.ensureSeed();

    var personal = SiteDB.getPersonal();
    var skills = SiteDB.getSkills();
    var avatarFile = await SiteDB.getFile('avatar');

    renderHero(personal, avatarFile);
    renderSkills(skills);
    renderProjects(await SiteDB.getProjects());
    renderBlogs(await SiteDB.getBlogs());
    await setupResumeDownload();

    initReveal();
  }

  // 弹窗事件
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  init();
})();
