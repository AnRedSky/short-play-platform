# 时间线编辑规范

## 目标与边界
MVP 提供生产型轻量时间线，不替代专业 NLE。时间线是非破坏性编辑描述，源视频/音频永不直接修改。

## 对象
Timeline、TimelineVersion、Track、Clip、Transition、AudioMix、SubtitleCue、ExportProfile。Track 类型为 video、audio、subtitle、overlay。Clip 引用明确 AssetVersion，保存 timeline_start、source_in、source_out、duration、z_order、volume、speed、transform 和效果参数。

## 时间基准
内部使用整数 PTS + 有理数 time_base；视频帧序号、音频采样点均为整数，并保留帧率/采样率分数。禁止毫秒或浮点秒作为权威持久化/API 字段。

## MVP 功能
镜头排序、片段入出点、轨道位置、音量、基础速度、字幕轨、背景音乐/音效、基础转场、画幅设置、预览和导出。高级关键帧、复杂特效、实时多人协同和专业调色列为后续。

## 规则
Clip 必须引用有效资产版本；源区间不能越界；轨道类型和素材 MIME 兼容；时间线保存新版本；预览和导出使用同一版本快照；导出期间不受后续编辑影响。字幕时间和音频混音参数可追溯。

## 验收
可创建多轨时间线；片段裁剪/排序结果可预览；源文件不变；版本可恢复；渲染结果与时间线快照一致。

## 2026-11-18 权威时码修订

本节替换旧版“整数毫秒或帧数”权威时间约定。Timeline/TimelineVersion/Track/Clip 必须使用整数 PTS + 有理数 time_base（numerator/denominator）。视频帧序号使用整数并保留帧率分数（如 30000/1001）；音频位置使用整数采样点并保留 sample_rate。源媒体保留原生 time_base。区间统一左闭右开 [in_pts, out_pts)。禁止浮点秒作为数据库/API/版本比较权威字段；UI 可显示格式化秒数，但必须由精确时码派生。

项目主时钟按已确认规格采用 1/70,560,000 秒；转换必须用整数/有理数运算并定义舍入规则。Clip 引用同项目 AssetVersion；导出绑定不可变 TimelineVersion。
