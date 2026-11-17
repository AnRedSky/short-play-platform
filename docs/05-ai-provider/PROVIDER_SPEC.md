# AI Provider 接入规范

## 1. 目标

建立统一的外部模型 API 接入层。业务模块只依赖能力契约，不依赖任何供应商 SDK、请求格式或专有状态码。开发早期通过 Mock Provider 完成端到端验证。

## 2. 能力接口

按能力定义独立协议：
- TextGenerationProvider
- ImageGenerationProvider
- VideoGenerationProvider
- SpeechGenerationProvider（TTS）
- SpeechRecognitionProvider（ASR）
- MusicGenerationProvider（按 MVP 范围启用）

统一包含能力标识、请求/结果 Schema、超时、取消能力（若供应商支持）、错误归一化、健康检查和用量摘要。视频等异步供应商需要 submit + poll/query；同步图片返回也应映射为已完成的 GenerationTask。

## 3. Provider 责任边界

Provider 负责外部 HTTP/SDK 调用、供应商协议转换、结果解析、错误码映射和健康检查。Provider 不写业务数据库、不创建业务资产、不决定剧本/分镜状态、不做权限判断。应用服务负责任务持久化、策略校验、资产登记和审计。

## 4. Registry 与 Router

- Registry：注册 Provider 实现及其能力，校验唯一标识和版本。
- Router：按能力、模型配置、管理员优先级、可用性和成本策略选择目标。
- Policy：按数据分类、项目授权、供应商区域/合同和外发审批控制是否允许发送内容。
- Fallback：仅在策略允许的候选供应商集合内切换；不得因故障绕过数据外发限制。
- 管理端可配置启用状态、并发、超时、速率限制和预算阈值。

## 5. 凭据与调用安全

- API Key 使用应用层加密密钥加密保存；密钥加密密钥来自部署密钥管理/环境变量，不入库、不入 Git。
- 读取凭据遵循最小权限；日志只记录凭据 ID/脱敏摘要。
- 外部 Base URL 仅管理员配置并进行协议、域名白名单、DNS/IP 和重定向校验，防止 SSRF。
- 外部文件 URL 下载时校验协议、域名、解析 IP、大小和 MIME；禁止访问 loopback、私网、链路本地和云元数据地址。
- 请求设置连接/读取超时、并发上限、速率限制、最大响应体和预算阈值。

## 6. 统一任务数据

每次模型调用关联 generation_task 与 generation_attempt。任务保存能力、模型、Provider、输入摘要、参数、幂等键、状态、重试策略；Attempt 保存供应商任务 ID、开始结束时间、耗时、错误码和响应摘要。原始请求/响应应脱敏并按数据保留策略存储。

## 7. 初期实现顺序

1. 定义 Pydantic contracts 和统一错误模型。
2. 实现 Mock Text/Image/Video/TTS Provider。
3. 实现 Registry、Router、Policy 和 ModelConfig。
4. 实现 Generation Application Service 与任务持久化。
5. 选择首个实际供应商并独立适配、契约测试。
6. 增加用量统计、预算控制、健康检查和供应商切换。

## 8. 验收

同一业务用例可在 Mock 与真实 Provider 间切换而不改业务模块；无凭据泄露；超时/限流/供应商错误被规范化；异步视频任务可查询状态；失败切换遵守外发策略；每次调用均有可追踪 Attempt 和用量记录。
