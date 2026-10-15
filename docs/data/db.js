/* =========================================================================
 * docs/data/db.js
 * 数据访问层：统一封装 IndexedDB（大文件 / Markdown 内容）+ localStorage（小配置）
 * 所有个人数据均由后台录入，本文件不包含任何硬编码的个人信息。
 * ========================================================================= */
(function (global) {
  'use strict';

  // ---------- 数据库与存储结构定义 ----------
  var DB_NAME = 'personal_site_db';
  var DB_VERSION = 1;

  // IndexedDB 对象仓库（keyPath 均为 id）
  var STORE_FILES = 'files';       // 头像图片 / PDF 简历（Blob 二进制）
  var STORE_PROJECTS = 'projects'; // 项目（含 Markdown 正文）
  var STORE_BLOGS = 'blogs';       // 博客（含 Markdown 正文）

  // localStorage 键名（轻量文本数据）
  var LS_PERSONAL = 'ps_personal';
  var LS_SKILLS = 'ps_skills';

  var dbPromise = null;

  // ---------- IndexedDB 打开（单例） ----------
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('当前浏览器不支持 IndexedDB'));
        return;
      }
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BLOGS)) {
          db.createObjectStore(STORE_BLOGS, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  // 将 IDBRequest 包装为 Promise
  function request(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // ---------- IndexedDB 基础操作 ----------
  function idbPut(store, value) {
    return openDB().then(function (db) {
      return request(db.transaction(store, 'readwrite').objectStore(store).put(value));
    });
  }
  function idbGet(store, key) {
    return openDB().then(function (db) {
      return request(db.transaction(store, 'readonly').objectStore(store).get(key));
    });
  }
  function idbGetAll(store) {
    return openDB().then(function (db) {
      return request(db.transaction(store, 'readonly').objectStore(store).getAll());
    });
  }
  function idbDelete(store, key) {
    return openDB().then(function (db) {
      return request(db.transaction(store, 'readwrite').objectStore(store).delete(key));
    });
  }

  // ---------- localStorage 基础操作 ----------
  function lsGet(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(key, value) {
    global.localStorage.setItem(key, JSON.stringify(value));
  }

  // 生成唯一 id
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- 个人信息（localStorage） ----------
  function getPersonal() {
    return lsGet(LS_PERSONAL, {
      name: '', bio: '', email: '', location: '', github: '', website: ''
    });
  }
  function savePersonal(info) {
    lsSet(LS_PERSONAL, info || {});
  }

  // ---------- 技能列表（localStorage） ----------
  // 结构：{ id, name, level }，level 为 0~100
  function getSkills() {
    return lsGet(LS_SKILLS, []);
  }
  function saveSkills(skills) {
    lsSet(LS_SKILLS, skills || []);
  }

  // ---------- 文件（头像 / 简历，IndexedDB Blob） ----------
  // id 约定：'avatar' = 头像图片；'resume' = PDF 简历
  function getFile(id) {
    return idbGet(STORE_FILES, id);
  }
  function saveFile(id, type, name, blob) {
    return idbPut(STORE_FILES, {
      id: id, type: type, name: name, blob: blob, updatedAt: Date.now()
    });
  }
  function deleteFile(id) {
    return idbDelete(STORE_FILES, id);
  }

  // ---------- 项目（IndexedDB） ----------
  // 结构：{ id, title, summary, tags[], link, cover, content(md), createdAt, updatedAt }
  function getProjects() {
    return idbGetAll(STORE_PROJECTS).then(function (list) {
      list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      return list;
    });
  }
  function getProject(id) {
    return idbGet(STORE_PROJECTS, id);
  }
  function saveProject(project) {
    var now = Date.now();
    project.id = project.id || genId();
    project.createdAt = project.createdAt || now;
    project.updatedAt = now;
    project.tags = Array.isArray(project.tags) ? project.tags : [];
    return idbPut(STORE_PROJECTS, project).then(function () { return project; });
  }
  function deleteProject(id) {
    return idbDelete(STORE_PROJECTS, id);
  }

  // ---------- 博客（IndexedDB） ----------
  // 结构：{ id, title, summary, tags[], content(md), createdAt, updatedAt }
  function getBlogs() {
    return idbGetAll(STORE_BLOGS).then(function (list) {
      list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      return list;
    });
  }
  function getBlog(id) {
    return idbGet(STORE_BLOGS, id);
  }
  function saveBlog(blog) {
    var now = Date.now();
    blog.id = blog.id || genId();
    blog.createdAt = blog.createdAt || now;
    blog.updatedAt = now;
    blog.tags = Array.isArray(blog.tags) ? blog.tags : [];
    return idbPut(STORE_BLOGS, blog).then(function () { return blog; });
  }
  function deleteBlog(id) {
    return idbDelete(STORE_BLOGS, id);
  }

  // ---------- 导出 API ----------
  global.SiteDB = {
    genId: genId,
    getPersonal: getPersonal,
    savePersonal: savePersonal,
    getSkills: getSkills,
    saveSkills: saveSkills,
    getFile: getFile,
    saveFile: saveFile,
    deleteFile: deleteFile,
    getProjects: getProjects,
    getProject: getProject,
    saveProject: saveProject,
    deleteProject: deleteProject,
    getBlogs: getBlogs,
    getBlog: getBlog,
    saveBlog: saveBlog,
    deleteBlog: deleteBlog
  };
})(window);
