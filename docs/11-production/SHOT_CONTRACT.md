# 镜头合同规范

## 目的
Shot Contract 是单个镜头进入 AI 生产前的结构化制作合同，是生成、审核、返工和追溯的依据。镜头合同按版本保存；批准版本不可原地覆盖。

## 必需字段
identity：project_id、episode_id、scene_id、shot_id、shot_code、contract_version。
story：叙事目的、情绪、剧情信息、与前后镜头关系。
camera：景别、机位、镜头运动、构图、焦点。
visual：画幅、风格、光线、色调、环境、画面描述。
references：角色/场景/道具的具体 asset_version_id。
character_states：角色外观、服装、情绪、姿态、持有道具。
action：动作描述、动作顺序、开始/结束状态。
audio：对白、说话人、voice profile、环境声、音乐提示。
duration：目标时长及允许范围。
constraints：模型能力要求、禁止元素、连续性要求。
quality_gate：技术、内容、连续性检查项。
generation：Prompt 模板版本、模型能力和参数快照。

## 示例
```json
{
  "shot_code": "EP01_SC02_SH003",
  "story": {"purpose": "主角发现信件", "emotion": "震惊"},
  "camera": {"shot_size": "medium_close_up", "angle": "eye_level", "movement": "slow_push_in"},
  "visual": {"aspect_ratio": "9:16", "lighting": "low_key"},
  "references": {"character_versions": [], "scene_version_id": null, "prop_version_ids": []},
  "action": {"description": "主角缓慢打开信件", "duration_seconds": 5},
  "audio": {"dialogue": "这不可能……", "voice_profile_id": null},
  "constraints": {"character_consistency": "required", "scene_consistency": "required"},
  "quality_gate": {"technical": true, "content": true, "continuity": true}
}
```

## 规则
进入生成前必须有有效合同版本；必填字段按镜头类型校验。资产引用锁定具体版本。Prompt 由合同和模板版本生成，保留渲染输入快照。批准后修改产生新版本；已生成结果继续关联旧版本。上游变化标记下游 stale，不覆盖已审核结果。重新生成创建新任务和候选结果，通过审核后才设为当前采用版本。合同修改、锁定和审核均审计；MVP 不提供豁免。

## 验收
合同可创建、校验、版本化；可关联资产版本；生成任务保存合同快照；合同更新不破坏旧结果；可比较版本并识别受影响镜头。

## 2026-11-18 决策修订

Shot Contract 的审核和质量结果遵循统一实施基线：QA 仅 PASS、REVIEW_REQUIRED、FAIL；不提供豁免/WAIVED。人工审核由项目级统一 review permission 控制，记录必须绑定具体 Contract Version。任何合同新版本均重新 QA/审核，旧版生成结果和审核历史保留但不继承结论。引用资产必须属于同一 project_id，并锁定 asset_version_id。
