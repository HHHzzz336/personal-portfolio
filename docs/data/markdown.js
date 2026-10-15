/* =========================================================================
 * docs/data/markdown.js
 * Markdown 解析与渲染封装：基于本地打包的 marked + DOMPurify。
 * - marked：把 Markdown 文本解析为 HTML
 * - DOMPurify：对 HTML 做安全净化，防止 XSS
 * - 最后对站外链接统一加上 target="_blank" / rel="noopener"
 * ========================================================================= */
(function (global) {
  'use strict';

  // 配置 marked
  if (typeof marked !== 'undefined' && marked.setOptions) {
    marked.setOptions({ gfm: true, breaks: true });
  }

  // 净化配置：允许 target 属性（用于新窗口打开外链）
  var PURIFY_CONFIG = { ADD_ATTR: ['target'] };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 对站外链接追加 target="_blank" 与 rel="noopener noreferrer"
  function postProcessLinks(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    var links = div.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href) && href.indexOf(global.location.origin) !== 0) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    }
    return div.innerHTML;
  }

  /**
   * 渲染 Markdown 文本为安全的 HTML 字符串。
   * @param {string} mdText Markdown 源码
   * @returns {Promise<string>} 渲染后的 HTML
   */
  async function render(mdText) {
    var source = mdText == null ? '' : String(mdText);

    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      try {
        var html = marked.parse(source);
        if (html && typeof html.then === 'function') {
          html = await html; // 兼容旧版 marked 返回 Promise 的情况
        }
        if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
          html = DOMPurify.sanitize(html, PURIFY_CONFIG);
        }
        return postProcessLinks(html);
      } catch (e) {
        if (global.console) console.error('Markdown 渲染失败，回退为纯文本：', e);
      }
    }

    // 无解析库时的兜底：转义后保留换行
    return escapeHtml(source).replace(/\n/g, '<br>');
  }

  global.MDRender = { render: render };
})(window);
