# 媒体合成与导出规范

## 输入
导出任务绑定 TimelineVersion、ExportProfile、字幕/音轨/片段资产版本和渲染参数快照。导出开始后输入不可变。

## FFmpeg 执行
通过受控 wrapper 生成参数数组并调用 subprocess；禁止 shell=True 或拼接用户输入。输入文件来自授权 StorageBackend；路径规范化并限制工作目录。设置超时、CPU/内存/并发、文件大小和输出时长上限。记录 FFmpeg 版本、命令参数脱敏摘要和 stderr 摘要。

## 流程
校验时间线与素材 → 准备临时工作目录 → 探测输入 → 生成 filter/concat/音频/字幕计划 → FFmpeg 渲染临时文件 → ffprobe 检查容器/编码/画幅/帧率/时长/流 → checksum → 原子发布 → 登记 AssetVersion/ExportJob → 清理临时文件。

## 输出
MVP 输出 MP4；按项目配置分辨率、帧率、视频/音频编码、画幅和字幕烧录/独立文件。可附带 SRT/VTT、封面和导出报告。编码参数必须来自白名单配置，不能接受任意命令参数。

## 失败与重试
记录失败阶段、错误码、日志摘要和资源消耗。每次导出创建独立 ExportJob 和临时目录，不覆盖旧成片。校验失败不得发布。取消时终止进程组并清理临时文件。

## 验收
MP4 可解码播放；ffprobe 参数符合 ExportProfile；字幕/音频同步；输出 checksum 与文件大小记录；失败不暴露半成品；重复导出可追踪且不覆盖历史版本。

## 2026-11-18 导出契约补充

ExportJob 必须绑定不可变 TimelineVersion、ExportProfile 和输入 AssetVersion 快照。Timeline Clip 的 source_in/source_out/timeline_start 使用整数 PTS + 有理数 time_base；不得在持久化/API 中使用浮点秒作为权威值。Media Worker 必须从精确时码构建 FFmpeg filter/concat 参数，并在输出后执行 ffprobe、完整解码、checksum 校验。当前图片序列 MP4 导出仅为已有基础能力，不等同本规范的多轨时间线导出完成。
