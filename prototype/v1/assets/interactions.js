/* ==========================================================================
   交互层：在 prototype.js 的展示原语之上，补齐"会改状态"的行为。
   - 抽屉/详情绑定：[data-open="drawer-id"] 会把自身 data-* 填进抽屉 [data-bind]
   - 动作总线：任何 [data-act] 元素点击后触发 proto:act 事件，由页面脚本处理
   - 会话内持久化：P.store.get/set/push（sessionStorage），刷新不丢演示数据
   ========================================================================== */
(function () {
  "use strict";
  const P = window.P;
  if (!P) return;
  const NS = "sp_proto_v2";

  function readAll() {
    try {
      return JSON.parse(sessionStorage.getItem(NS) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function writeAll(o) {
    try {
      sessionStorage.setItem(NS, JSON.stringify(o));
    } catch (e) {}
  }

  P.store = {
    get(k, d) {
      const o = readAll();
      return k in o ? o[k] : d;
    },
    set(k, v) {
      const o = readAll();
      o[k] = v;
      writeAll(o);
      return v;
    },
    push(k, item) {
      const arr = P.store.get(k, []);
      arr.push(item);
      P.store.set(k, arr);
      return arr;
    },
  };

  P.uid = function (p) {
    return (p || "obj") + "_" + Math.random().toString(36).slice(2, 7);
  };

  P.time = function () {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  };

  P.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  };

  const PILL = {
    active: "pass", approved: "pass", succeeded: "pass", ready: "pass", pass: "pass",
    in_review: "review", review: "review", pending: "review", queued: "review",
    retry_wait: "review", waiting: "review", paused: "review", invited: "review",
    running: "info", processing: "info", rendering: "info", validating: "info", created: "draft",
    failed: "fail", fail: "fail", blocked: "fail", revoked: "fail", suspended: "fail",
    draft: "draft", archived: "draft", skipped: "draft", cancelled: "draft", on_hold: "review",
  };
  P.pillFor = function (state) {
    return PILL[state] || "draft";
  };
  P.setPill = function (el, state, label) {
    if (!el) return;
    el.className = "pill " + P.pillFor(state);
    el.textContent = label || state;
  };
  P.count = function (el, n) {
    if (!el) return;
    if (typeof el === "string") el = document.querySelector(el);
    if (el) el.textContent = n;
  };
  P.addRow = function (tbody, html) {
    if (typeof tbody === "string") tbody = document.querySelector(tbody);
    if (!tbody) return null;
    const tmp = document.createElement("tbody");
    tmp.innerHTML = html.trim();
    const row = tmp.firstElementChild;
    if (!row) return null;
    tbody.insertBefore(row, tbody.firstElementChild);
    return row;
  };
  P.remove = function (el) {
    const node = el && el.closest("tr, .asset-card, .tree-item, .index-card, .shot-card, [data-card]");
    if (node) node.remove();
    return node;
  };
  P.download = function (name, text, mime) {
    const blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 300);
  };
  P.csv = function (rows) {
    return rows
      .map((r) => r.map((c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(","))
      .join("\r\n");
  };

  /* 点击 [data-open]：打开抽屉 / 弹窗，并用自身 dataset 回填 [data-bind] */
  function fill(container, data) {
    if (!container) return;
    container.querySelectorAll("[data-bind]").forEach((n) => {
      const k = n.dataset.bind;
      if (data[k] === undefined || data[k] === "") return;
      if (n.tagName === "INPUT" || n.tagName === "TEXTAREA") n.value = data[k];
      else if (n.tagName === "SELECT") {
        const opt = Array.prototype.find.call(n.options, (o) => o.value === data[k] || o.textContent === data[k]);
        if (opt) n.value = opt.value;
      } else n.textContent = data[k];
    });
  }

  document.addEventListener("click", function (e) {
    const opener = e.target.closest("[data-open]");
    if (opener && !e.target.closest("button[data-act], a, button[data-toast]")) {
      const id = opener.dataset.open;
      const target = document.getElementById(id);
      if (target && target.classList.contains("modal")) P.openModal(id);
      else if (target && target.classList.contains("drawer")) P.openDrawer(id);
      fill(target, opener.dataset);
      const group = opener.closest("[data-open-group]");
      if (group) {
        group.querySelectorAll(".on, .is-selected").forEach((n) => {
          if (n !== opener && !n.classList.contains("tree-item")) n.classList.remove("on");
        });
        opener.classList.add("on");
      }
      document.dispatchEvent(new CustomEvent("proto:select", { detail: { el: opener, target: target } }));
    }

    const act = e.target.closest("[data-act]");
    if (act) {
      document.dispatchEvent(new CustomEvent("proto:act", { detail: { act: act.dataset.act, el: act } }));
    }
  });

  /* 快捷键：/ 聚焦搜索，Ctrl/Cmd+S 触发保存按钮，Esc 关闭浮层 */
  document.addEventListener("keydown", function (e) {
    const typing = /input|textarea|select/i.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) {
      const s = document.querySelector(".toolbar .search input, input[type='search']");
      if (s) {
        e.preventDefault();
        s.focus();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      const btn = document.querySelector("[data-save]");
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
  });

  /* 表单提交：阻止默认并派发 proto:submit，页面拿到 FormData */
  document.addEventListener("submit", function (e) {
    const form = e.target;
    if (!form.matches("form[data-form]")) return;
    e.preventDefault();
    const fd = {};
    new FormData(form).forEach((v, k) => {
      if (k in fd) {
        if (!Array.isArray(fd[k])) fd[k] = [fd[k]];
        fd[k].push(v);
      } else fd[k] = v;
    });
    const detail = { name: form.dataset.form, data: fd, form: form, keepOpen: false };
    document.dispatchEvent(new CustomEvent("proto:submit", { detail: detail }));
    if (!detail.keepOpen) P.closeModal(form.closest(".modal") ? form.closest(".modal").id : "");
  });

  P.fill = fill;
})();
