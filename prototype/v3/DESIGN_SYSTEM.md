# UI 设计系统与响应式规范

## 1. 视觉方向
企业级创作生产 SaaS，强调高密度信息、稳定层级和清晰状态。主背景为雾白灰，内容卡片白色，品牌色靛蓝紫；成功/警告/失败使用低饱和语义色。避免大面积渐变和过度装饰。桌面工作区以数据表、筛选工具条、右侧详情抽屉为核心。

## 2. Design tokens
| Token | 值 | 用途 |
|---|---|---|
| color.brand | #5B5CE2 | 主按钮、选中导航、链接 |
| color.brand-soft | #F0F0FF | 选中背景 |
| color.text | #202238 | 标题/正文 |
| color.muted | #777B91 | 辅助信息 |
| color.canvas | #F5F6FA | 页面背景 |
| color.surface | #FFFFFF | 卡片/抽屉 |
| color.border | #E8EAF1 | 分割线/边框 |
| color.success | #16845B | 完成/通过 |
| color.warning | #B7791F | 处理中/待审 |
| color.danger | #C44752 | 失败/拒绝 |
| radius.sm/md/lg | 6/10/16px | 输入、卡片、弹窗 |
| spacing | 4/8/12/16/24/32px | 组件间距 |
| font | Inter, system-ui, "PingFang SC" | 全局 |
| shadow.drawer | 0 16px 48px rgba(20,24,50,.18) | 抽屉 |

## 3. 标准桌面结构
- 设计基准：1440×900；最小桌面宽 1200px。
- 左侧主导航 248px 固定；顶部栏 68px；内容区左右 padding 32px；内容最大宽度 1600px。
- 项目内导航在左侧主导航分组下展开；内容区由面包屑、标题区、筛选工具栏、数据区域组成。
- 表格行高 56px；表单输入 40px；按钮 36/40px；卡片 padding 20/24px。
- 抽屉宽 520px（宽屏 560px）；确认弹窗 440–520px。

## 4. 组件规范
- Button：primary/secondary/ghost/danger；高度 36px，圆角 8px；loading 显示 spinner 且禁用。
- Input/Select：高度 40px；标签在上；placeholder 只作示例，不代替标签；错误信息位于字段下方。
- Table：表头浅底、hover 行、稳定排序、分页、选择框；状态使用语义 badge。
- Badge：success/warning/danger/neutral；文字同时表达状态，不只靠颜色。
- Drawer：右侧滑入、遮罩、固定标题/底部操作；Esc 关闭；未保存提示。
- Modal：危险动作二次确认；聚焦默认安全操作；确认按钮需明确动词。
- Toast：右下角 3 秒；错误保留更长并带 request_id。
- EmptyState：解释为何为空并提供权限允许的下一步。
- Skeleton：与最终内容相同的几何布局，避免页面跳动。

## 5. 响应式断点
| 视口 | 导航 | 内容布局 | 表格/表单 | 抽屉 |
|---|---|---|---|---|
| ≥1440 | 248px 固定侧栏 | 12 栅格；筛选单行 | 完整表格列 | 520–560px |
| 1200–1439 | 224px 侧栏 | 12 栅格，卡片间距 16 | 次要列可隐藏 | 480px |
| 768–1199 | 72px 图标侧栏，可展开 | 单主列；统计卡 2 列 | 表格横向滚动/列优先级 |  min(520px, 90vw) |
| 480–767 | 侧栏改为遮罩抽屉；顶栏保留项目切换 | 单列；页面 padding 16 | 表格转卡片或横滑；筛选折叠 | 全宽底部/右侧全屏 |
| <480 | 底部导航/菜单抽屉 | 单列；关键 CTA 固定底部 | 卡片化，避免横向整页溢出 | 全屏 |

## 6. 可访问性与工程交付
- 对比度达到 WCAG AA；焦点可见；键盘可达；表单 label 与控件关联；错误有 aria-live。
- 状态同时用文字和图标表达；不只依赖颜色。
- 动画尊重 prefers-reduced-motion；触控目标 ≥44×44px。
- 前端开发建议将 token 转为 CSS variables；组件拆分 AppShell、Sidebar、Topbar、PageHeader、FilterBar、DataTable、StatusBadge、FormField、Drawer、Modal、Toast、EmptyState、Skeleton。
- 原型用纯 HTML/CSS/JS 实现；正式页面必须沿用仓库 Vue 3 + TypeScript + Pinia + Vue Router 技术栈，不能将原型脚本直接搬入生产。
