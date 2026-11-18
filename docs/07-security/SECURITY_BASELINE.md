# 安全基线

## 身份与权限
密码使用 Argon2id 或经评估的现代哈希；会话/JWT 生命周期、刷新、注销和密钥轮换明确。登录限速、防账户枚举。RBAC 与项目成员授权均在服务端执行；防 IDOR。敏感操作和权限变更审计。

## AI 外发
所有外部模型调用先经数据分类、项目授权、供应商区域/合同和外发 Policy。默认拒绝未经批准的敏感数据外发。密钥加密存储，主密钥安全注入；日志脱敏。模型输出作为不可信数据处理，禁止直接作为可执行指令。

## 网络与 SSRF
管理员配置 Provider 域名白名单；限制 HTTP(S) 协议、DNS 解析地址、重定向次数和最终 IP；拒绝 loopback、私网、链路本地和云元数据地址。外部结果下载限制文件大小、MIME、时长和资源消耗。

## 文件与媒体
校验扩展名、MIME、文件签名、大小、分辨率和时长；随机化 storage_key；下载鉴权；防路径穿越。FFmpeg 通过参数数组调用 subprocess，禁止 shell=True 和用户输入拼接；设置超时、CPU/内存/并发限制，失败文件隔离。

## 应用和容器
Pydantic 输入校验、参数化 SQL、CORS 白名单、Secure/HttpOnly/SameSite Cookie、生产禁 debug。容器非 root、最小权限、依赖锁定和漏洞扫描。错误响应不泄露堆栈、密钥和内部地址。

## 审计与响应
记录 actor、action、resource、时间、request_id、结果和必要变更摘要。普通业务用户不可修改审计记录。建立凭据泄露、异常外发、恶意文件、数据误删和服务中断响应流程；定期备份恢复演练。

## 2026-11-18 项目与 Provider 安全补充

所有 Asset/AssetVersion 必须归属单一 project_id；任何引用均验证同项目及当前用户项目授权，禁止跨项目搜索/共享/引用。下载、预览、上传和异步任务状态查询均需服务端授权，防止 IDOR。

Provider 默认 Mork；未配置有效凭据必须失败关闭并返回 PROVIDER_NOT_CONFIGURED，不得静默 Mock fallback。凭据只通过安全密钥引用/加密配置管理，不进入 Git、前端或日志。外部供应商调用前执行项目授权和数据外发策略；本期不建设第三方业务系统、Webhook 或爬虫接入。

媒体时间 API/DB 使用整数 PTS + 有理数 time_base；禁止 float 秒权威字段。QA 仅 PASS/REVIEW_REQUIRED/FAIL，无 WAIVED 豁免路径。
