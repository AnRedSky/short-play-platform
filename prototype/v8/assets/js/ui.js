/* UI：纯渲染组件，不持有业务状态、不访问 App。 */
window.UI={
 esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));},
 tag(v){const s=String(v??"");let t=/成功|已交付|已验证|通过|已确认|正式/.test(s)?"green":/异常|失败|待人工|需处理|禁用/.test(s)?"red":/待审核|排队|执行中|待验证|处理中/.test(s)?"amber":"blue";return '<span class="pill '+t+'">'+this.esc(s||"—")+'</span>';},
 btn(label,action,kind=""){return '<button type="button" class="btn '+kind+'" data-action="'+this.esc(action)+'">'+this.esc(label)+'</button>';},
 card(title,body,extra=""){return '<section class="card"><h3 class="section-title">'+title+'</h3>'+body+extra+'</section>';},
 metric(label,value,foot,icon="↗"){return '<section class="card"><span class="metric-icon">'+icon+'</span><div class="metric-label">'+label+'</div><div class="metric-value">'+value+'</div><div class="metric-foot">'+foot+'</div></section>';},
 table(headers,rows){return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join("")+'</tr></thead><tbody>'+rows+'</tbody></table></div>';},
 empty(text){return '<div class="empty">'+text+'</div>';},
 head(title,desc,actions=""){return '<div class="page-head"><div><div class="eyebrow">FRAME / WORKSPACE</div><h1>'+title+'</h1><p>'+desc+'</p></div><div class="head-actions">'+actions+'</div></div>';},
 field(label,name,placeholder="",type="text"){return '<div class="field"><label>'+label+'</label><input name="'+name+'" type="'+type+'" placeholder="'+placeholder+'"></div>';},
 select(label,name,options){return '<div class="field"><label>'+label+'</label><select name="'+name+'">'+options.map(x=>'<option>'+x+'</option>').join("")+'</select></div>';},
 bars(labels,values){const max=Math.max(...values,1);return '<div class="bar-chart">'+labels.map((l,i)=>'<div class="bar-col"><div class="bar-track"><span style="height:'+Math.round(values[i]/max*100)+'%"></span></div><b>'+values[i]+'</b><small>'+l+'</small></div>').join("")+'</div>';}
};