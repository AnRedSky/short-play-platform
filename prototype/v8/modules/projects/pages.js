(function () {
  AppModule.register({ routes: [
    {
      path: "projects/list", title: "项目管理", permission: "projects.read",
      render() {
        const body = '<div class="toolbar"><input class="search" placeholder="搜索项目名称或编号"><span class="pill">共 ' + DB.projects.length + ' 个演示项目</span></div>' +
          UI.table(["项目","负责人","题材","集数进度","状态","实际费用（演示）","操作"], App.tableProjects()) +
          '<p class="footer-note">费用示例仅用于原型布局；正式系统需按个人账户扣费、企业承担、报销和赠送额度分别统计。</p>';
        return UI.head("项目管理","企业项目归属企业空间，负责人和执行人按实际操作记录。",UI.btn("＋ 新建项目","new-project","primary")) + UI.card("项目列表",body);
      }
    },
    {
      path: "projects/workbench", title: "我的工作台", permission: "overview.read",
      render() {
        const mine = DB.projects.filter(p => p.ownerId === "u1");
        const projectRows = mine.map(p => '<div class="list-row"><div><b>' + p.name + '</b><div class="small muted">' + p.id + ' · ' + p.done + '/' + p.episodes + ' 集</div></div>' + UI.tag(p.status) + '</div>').join("");
        const process = '<div class="timeline"><div class="timeline-item"><strong>01 创意输入与剧本</strong><p>选择自由描述、题材、梗概或角色驱动等方式。</p></div><div class="timeline-item"><strong>02 剧本审核</strong><p>员工确认正式剧本版本后进入制作。</p></div><div class="timeline-item"><strong>03 导演、视觉、视频与音频</strong><p>AI 按镜头生产计划执行任务。</p></div><div class="timeline-item"><strong>04 后期、质检和交付</strong><p>局部返工后由员工完成最终成片审核。</p></div></div>';
        return UI.head("我的工作台","从项目目标开始，按业务流程独立完成 AI 短剧制作。",UI.btn("＋ 创建项目","new-project","primary")) +
          '<div class="grid grid-4">' + UI.metric("我的项目",mine.length,"本人负责的项目","▦") + UI.metric("待我审核","1","剧本或成片审核","✓") + UI.metric("执行中任务","2","来自生产任务台账","◷") + UI.metric("个人资源配置","2","独立配置、独立授权","◇") + '</div>' +
          '<div class="grid grid-2" style="margin-top:16px">' + UI.card("继续制作",projectRows + UI.btn("进入创意与剧本","generate","primary")) + UI.card("生产流程",process) + '</div>';
      }
    }
  ]});
})();