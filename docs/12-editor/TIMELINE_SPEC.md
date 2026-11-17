# 时间线编辑规范

## 目标与边界
MVP 提供生产型轻量时间线，不替代专业 NLE。时间线是非破坏性编辑描述，源视频/音频永不直接修改。

## 对象
Timeline、TimelineVersion、Track、Clip、Transition、AudioMix、SubtitleCue、ExportProfile。Track 类型为 video、audio、subtitle、overlay。Clip 引用明确 AssetVersion，保存 timeline_start、source_in、source_out、duration、z_order、volume、speed、transform 和效果参数。

## 时间基准
内部使用整数毫秒或帧数并明确项目 frame_rate，避免浮点秒累计误差。时间线版本保存画幅、帧率、音频采样率和轨道顺序。MVP 可用毫秒并在渲染时转换帧。

## MVP 功能
镜头排序、片段入出点、轨道位置、音量、基础速度、字幕轨、背景音乐/音效、基础转场、画幅设置、预览和导出。高级关键帧、复杂特效、实时多人协同和专业调色列为后续。

## 规则
Clip 必须引用有效资产版本；源区间不能越界；轨道类型和素材 MIME 兼容；时间线保存新版本；预览和导出使用同一版本快照；导出期间不受后续编辑影响。字幕时间和音频混音参数可追溯。

## 验收
可创建多轨时间线；片段裁剪/排序结果可预览；源文件不变；版本可恢复；渲染结果与时间线快照一致。
