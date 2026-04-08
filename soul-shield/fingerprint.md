# 灵魂指纹系统

> 一枚 Relic 可以模仿风格，但不能没有指纹。

## 目标

灵魂指纹系统负责四件事：

- 为每个 Relic 生成唯一指纹
- 把同一枚指纹嵌入所有输出文件
- 在加载、分享、归档时验证真实性
- 在内容被偷偷改动时触发防篡改检测

## 指纹生成规则

每个 Relic 的指纹都基于核心内容的规范化哈希生成。

### 1. 收集核心文件

推荐纳入以下文件：

- `SKILL.md`
- `personality.md`
- `interaction.md`
- `memory.md`
- `manifest.json`

如果某个 Relic 没有其中某个文件，就跳过该文件；但一旦后续新增该文件，必须重签指纹。

### 2. 规范化内容

计算前先做统一处理：

- 编码统一为 `UTF-8`
- 换行统一为 `LF`
- 去掉每行末尾多余空格
- 按文件路径字典序排序
- 忽略文件中已有的指纹字段，避免“把自己的签名再签一遍”

计算时应排除以下元数据字段：

- Markdown front matter 中的 `relic-fingerprint`
- Markdown front matter 中的 `relic-authenticity`
- JSON 中的 `fingerprint`
- JSON 中的 `previous_fingerprint`
- JSON 中的 `issued_at`
- JSON 中的 `fingerprint_version`

### 3. 先算单文件哈希，再算总指纹

先为每个核心文件计算 `SHA-256`，再按下面格式拼接：

```text
SKILL.md:<sha256>
interaction.md:<sha256>
manifest.json:<sha256>
memory.md:<sha256>
personality.md:<sha256>
```

然后对拼接结果再次计算 `SHA-256`，得到最终灵魂指纹。

推荐格式：

```text
relic:sha256:<64位十六进制哈希>
```

## 嵌入规则

所有输出文件都应携带同一个灵魂指纹。

### Markdown 文件

在文件头部写入：

```yaml
---
relic-fingerprint: relic:sha256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
relic-authenticity: verified
---
```

### JSON 文件

在根对象中写入：

```json
{
  "fingerprint": "relic:sha256:...",
  "authenticity": "verified"
}
```

### 图片、音频、视频等衍生资源

不强行改写原文件内容，而是在 `manifest.json` 中登记：

- 文件名
- 资源哈希
- 所属 Relic 指纹
- 生成时间

## 验证规则

每次加载或发布前都重新计算核心文件哈希，并与嵌入指纹比对：

- 指纹一致：判定为“真实”
- 指纹缺失：判定为“来源不完整”
- 指纹不一致：判定为“可能被篡改”
- 核心文件集变化但未重签：判定为“版本漂移”

## 防篡改检测结果

| 状态 | 含义 | 处理方式 |
|---|---|---|
| 通过 | 指纹一致，文件完整 | 正常加载 |
| 缺章 | 文件存在但未嵌入指纹 | 补写指纹后再发布 |
| 漂移 | 内容有更新但未重签 | 重新生成指纹并更新 manifest |
| 警报 | 指纹与内容不一致 | 停止加载，标记为疑似篡改 |

## 更新原则

- 任何核心内容被修改，都必须生成新指纹
- 新版本应在 `manifest.json` 中记录：`fingerprint`、`previous_fingerprint`、`issued_at`、`fingerprint_version`
- 灵魂指纹用于验证真实性，不用于替代授权协议
- 有指纹不等于有授权；指纹与授权同时成立，Relic 才能上线

## 最小示例

```json
{
  "name": "grandma-relic",
  "fingerprint": "relic:sha256:8f0d7d0f1f5d6a8a3f5a1d1d9f2d7c3b8a4c6e7f0d1a2b3c4d5e6f7081920abc",
  "previous_fingerprint": null,
  "issued_at": "2026-03-01T00:00:00Z",
  "fingerprint_version": "1.0"
}
```
