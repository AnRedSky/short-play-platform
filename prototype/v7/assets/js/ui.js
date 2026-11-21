/* UI layer: stateless rendering primitives only. */
window.UI={
  esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  tag(text,tone=''){return `<span class="tag ${tone}">${this.esc(text)}</span>`;},
  btn(text,action,kind=''){return `<button class="btn ${kind}" data-action="${this.esc(action)}">${text}</button>`;},
  metric(label,value,foot,mark='↗'){return `<article class="card metric"><span class="metric-mark">${mark}</span><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></article>`;},
  page(kicker,title,desc,actions='',body=''){return `<section class="page"><header class="page-head"><div><div class="eyebrow">${kicker}</div><h1 class="page-title">${title}</h1><p class="page-desc">${desc}</p></div><div class="head-actions">${actions}</div></header>${body}</section>`;},
  card(title,content,sub=''){return `<section class="card"><div class="card-head"><div><div class="card-title">${title}</div>${sub?`<div class="card-sub">${sub}</div>`:''}</div></div>${content}</section>`;},
  table(headers,rows){return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}"><div class="empty">没有符合条件的记录</div></td></tr>`}</tbody></table></div>`;},
  field(label,name,value='',type='text',hint=''){return `<label class="field-wrap"><span class="field-label">${label}</span><input class="field" name="${name}" type="${type}" value="${this.esc(value)}">${hint?`<span class="field-hint">${hint}</span>`:''}</label>`;},
  select(label,name,options,value=''){return `<label class="field-wrap"><span class="field-label">${label}</span><select class="field" name="${name}">${options.map(o=>`<option value="${o.value}" ${o.value===value?'selected':''}>${o.label}</option>`).join('')}</select></label>`;},
  empty(title,desc,action=''){return `<div class="empty"><div class="empty-icon">◌</div><b>${title}</b><p>${desc}</p>${action}</div>`;},
  chart(values,labels){return `<div class="chart-bars">${values.map((v,i)=>`<div class="chart-col"><div class="chart-bar ${i===values.length-1?'em':''}" style="height:${v}%"></div><span class="chart-label">${labels[i]}</span></div>`).join('')}</div>`;},
  progress(value,label){return `<div class="progress-label"><span>${label}</span><b>${value}%</b></div><div class="progress"><span style="width:${value}%"></span></div>`;}
};
