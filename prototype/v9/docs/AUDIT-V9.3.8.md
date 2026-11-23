# V9.3.8 审查记录：侧栏分组折叠导航

## 结论

侧栏从 65 条路由的平铺清单改为按业务域分组的手风琴导航。默认只展开当前页面所属分组，点击其他组标题会收起上一组并展开目标组；owner 身份下侧栏从 48 条链接的长列表收敛为 14 个分组标题加当前组链接。

## 主要改动

### 1. 分组导航结构

- `navHtml()` 输出 `section.nav-group-wrap`，每组包含一个 `button.nav-group-head` 与 `div.nav-links`。
- 组标题展示业务域名与「该组当前身份可见路由数」，右侧箭头指示展开状态。
- 只有当前路由所属组带 `is-active` 与默认展开；其他组链接以 `max-height:0` 折叠。
- 导航仍由模块注册表与 `hasPerm` 派生，不另写静态菜单；无权限模块整组不渲染。

### 2. 展开状态与交互

- 新增 `S.navOpen`：`null` 表示跟随当前路由自动展开；空字符串表示全部收起；组 key 表示仅展开该组。
- 新增注册动作 `common.navGroup`，点击组标题切换展开组。
- 折叠只改 `.nav-group-wrap` 的 `is-open` 与 `aria-expanded`，不重建 `shell()`，页面滚动位置与表单状态不会被重置。
- `hashchange` 将 `S.navOpen` 重置为 `null`，跳转后自动展开新页面所属分组。
- `base.css` 移除旧 `.nav-group` 平铺标题，新增组标题、计数、箭头、链接容器与展开过渡。

### 3. 浏览器实测

在 owner 身份、`#/workspace/home` 下：

- 渲染 14 个可见分组，仅「我的工作台」`aria-expanded=true`，其余 13 组为 false。
- 侧栏共 48 条可见链接；注册路由总数仍为 65 条。
- 点击「创意与剧本」后，展开组集合为 `['creation']`，`workspace` 变为折叠，手风琴行为生效。
- 点击 `#/creation/brief` 后，`hashchange` 自动把 `creation` 保持为唯一展开组，且该组为当前组。
- 品牌副标题与页面标题均显示「第 9.3.8 版」。
- 截图：`docs/nav-home-938.png`（工作台首页，当前组展开）、`docs/nav-collapse-938.png`（创作页，当前组自动展开、其余组折叠）。
- 折叠容器设置 `visibility:hidden` 与 `aria-hidden=true`，键盘 Tab 不会进入已折叠链接。

## 验证

- `node --check assets/js/app.js`：通过。
- `node tools/regress.mjs`：17 模块、65 路由通过；owner 48 / admin 32 / dept 24 / staff 41 / auditor 24 / ops 4。
- `node tools/_audit_actions.mjs`：注册 305、引用 256、未注册 0。
- `node tools/_audit_perms.mjs`：34 权限码、21 守卫码、missing none。
- `node tools/flow.mjs`：18 / 18 通过。
- `_smoke.html`：65 路由正常，无 JS 错误、无 undefined / NaN，角色切换拦截正常。
- `_e2e.html`：全项 PASS，`E2E OK`。
- 测试后已 `Store.reset()`，回到 7 项目基线。

## 未决

- 当前为「同一时间只展开一组」；是否允许多组同时展开、是否增加桌面端整栏收起、折叠状态是否跨刷新持久化，尚未确认。
- 小屏下组标题数量仍较多，后续可评估二级分组或搜索定位。
- `prototype/v9` 仍为 git untracked，尚未提交。
