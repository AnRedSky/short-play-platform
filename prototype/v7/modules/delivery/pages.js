App.register({group:'delivery',label:'审核与交付',icon:'⇧',routes:[
{path:'delivery/review',title:'成片终审',icon:'◉',permission:'delivery',render(){
 const p=App.project();if(!p)return UI.page('HUMAN GATE / FINAL CUT','尚未选择项目','选择当前租户内待终审的项目。','',`<div class="card">${UI.empty('没有可终审项目','当前身份没有可访问的项目。')}</div>`);
 const approved=!!p.finalApproved;
 return UI.page('HUMAN GATE / FINAL CUT','最终成片审核','人工审核节点 B：确认当前项目的内容、画面、音频、字幕、集数完整性与交付质量。',UI.btn('进入交付中心','go:delivery/center','btn'),`
 <div class="notice warn">AI 质检通过不等于正式交付。必须由员工完成当前项目的最终成片审核，才能进入交付归档。</div>
 <div class="grid grid-3 section-gap">${UI.metric('当前终审项目',UI.esc(p.title),UI.esc(p.id),'◉')}${UI.metric('质量评分',p.quality||'待检测','演示质量指标，不代表真实检测','✓')}${UI.metric('集数进度',(p.done||0)+' / '+p.episodes,'当前项目完成情况','!')}</div>
 <div class="grid grid-2 section-gap"><div class="card card-dark"><div class="eyebrow" style="color:var(--lime)">FINAL CUT / PREVIEW</div><div style="height:210px;background:linear-gradient(135deg,#344b55,#141e27);border-radius:10px;display:grid;place-items:center;margin:12px 0"><div style="text-align:center"><div style="font-size:34px">▶</div><div class="tiny" style="color:#bdc8ca">演示预览画面 · 不包含真实视频流</div></div></div><div class="small">${UI.esc(p.title)} · ${p.episodes} 集 · 当前候选交付版本</div></div>
 <div class="card"><div class="card-title">最终审核清单</div>${['剧情完整与故事闭环','人物形象及跨集一致性','视频画面与镜头衔接','配音、配乐与音效质量','字幕准确性与时间轴','集数完整及交付文件齐全','内容合规与版权授权'].map((x,i)=>`<label class="kpi-line"><span>${x}</span><input type="checkbox" data-review-check="${i}" ${p.reviewChecks?.includes(i)?'checked':''}></label>`).join('')}
 <div class="field-wrap section-gap"><span class="field-label">审核意见</span><textarea class="field" data-project-field="finalReviewNote" placeholder="记录当前项目的最终审核结论或指定返修范围">${UI.esc(p.finalReviewNote||'')}</textarea></div><div class="section-gap">${UI.btn(approved?'审核已通过':'审核通过','final:approve','btn-lime')}</div></div></div>`);
}},
{path:'delivery/center',title:'作品交付中心',icon:'⇧',permission:'delivery',render(){
 const p=App.project();if(!p)return UI.page('DELIVERY / RELEASE','尚未选择项目','选择项目后查看交付包与归档状态。','',`<div class="card">${UI.empty('没有可交付项目','当前身份没有可访问的项目。')}</div>`);
 const delivered=!!p.delivered,approved=!!p.finalApproved;
 return UI.page('DELIVERY / RELEASE','作品交付与归档','管理当前项目的正式成片、分集文件、字幕、封面、交付清单和版本追溯。',UI.btn('查看终审','go:delivery/review','btn'),`
 <div class="grid grid-3">${UI.metric('当前交付项目',UI.esc(p.title),UI.esc(p.id),'⇧')}${UI.metric('集数完整度',(p.done||0)+' / '+p.episodes,'按当前项目进度展示','✓')}${UI.metric('交付状态',delivered?'已归档':approved?'待生成交付包':'待终审','状态与当前项目绑定','▧')}</div>
 <div class="card section-gap"><div class="card-head"><div><div class="card-title">交付单 · ${UI.esc(p.title)}</div><div class="card-sub mono">项目 ${UI.esc(p.id)} / ${p.episodes} Episodes</div></div>${UI.tag(delivered?'已归档':approved?'待生成交付包':'待终审',delivered?'green':'orange')}</div>
 <div class="grid grid-2"><div><div class="kpi-line"><span>成片文件</span><b>${p.done||0} / ${p.episodes} 集</b></div><div class="kpi-line"><span>字幕文件</span><b>${p.done||0} / ${p.episodes} 集</b></div><div class="kpi-line"><span>封面与海报</span><b>${p.coverAssets||0} 项</b></div><div class="kpi-line"><span>交付清单</span><b>${delivered?'已归档':approved?'等待生成':'等待终审'}</b></div></div>
 <div><div class="notice ${approved?'success':'warn'}">${approved?'当前项目已通过最终审核，可以生成演示交付记录。':'交付包需等待当前项目最终审核通过后才能生成。'}</div><div class="section-gap">${UI.btn(delivered?'已完成正式归档':'生成交付包并归档','delivery:publish','btn-lime')}</div><div class="tiny muted section-gap">演示交互：仅更新当前项目内存状态，不生成真实媒体文件。</div></div></div></div>`);
}}
]});