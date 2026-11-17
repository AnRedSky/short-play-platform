# AI Provider 接入规范

## 能力契约
TextGeneration、ImageGeneration、VideoGeneration、TTS、ASR、MusicGeneration 独立定义请求/结果 Schema。统一能力标识、超时、错误模型、任务状态、取消能力、用量摘要和健康检查。同步图片和异步视频最终都映射为 GenerationTask。

## 责任边界
Provider 负责 HTTP/SDK 协议适配、请求响应转换、供应商状态映射、错误归一化和健康检查。Provider 不写业务数据库、不创建资产、不判断项目权限、不修改剧本/镜头状态。应用服务负责策略、任务、Attempt、资产、用量和审计。

## Registry / Capability Catalog / Router / Policy
Registry 注册适配器；Capability Catalog 声明模型能力、输入要求、限制和计价单位；Router 根据任务能力、输入兼容、项目策略、预算、健康状态和管理员优先级选择模型；Policy 校验数据分类、授权、供应商区域/合同、预算和外发策略。Fallback 只能在策略允许的候选集内执行。

## 凭据与网络安全
API Key 应用层加密；加密主密钥通过安全渠道注入且不入库/Git；日志只记录凭据 ID 和脱敏摘要。Base URL 仅管理员配置；限制协议/域名，校验 DNS/IP、重定向和 TLS。下载外部结果限制私网/loopback/链路本地/元数据地址，校验大小、MIME、时长和校验和。请求有连接/读取超时、速率、并发和响应体限制。

## 任务与用量
GenerationTask 保存能力、模型、Provider、参数、Prompt 版本/摘要、输入快照、幂等键和状态；TaskAttempt 保存供应商 task ID、请求/响应摘要、错误码、时间和耗时。敏感内容按分类与保留策略存储。用量区分供应商账单、接口返回 usage 和平台估算。

## 实施顺序
P0 contracts + Mock Text/Image/Video/TTS；P0 Registry/Router/Policy；P0 Generation Application Service；P1 首个真实 LLM/Image/Video/TTS Provider 按需接入；P1 用量、预算、健康和回退。Mock 是 CI 默认路径，真实 API 测试仅在受控环境运行。

## 验收
Mock 与真实 Provider 可替换而不修改业务模块；错误/超时/限流归一；异步任务可查询；凭据不泄露；每次调用有 Attempt、审计和用量记录；故障切换不绕过数据外发策略。
