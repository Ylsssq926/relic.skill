# Spec Template

## Document Structure

```markdown
# 需求规格：{{feature_name}}

## 1. 概述
### 1.1 项目背景
### 1.2 功能范围
### 1.3 非目标（排除范围）

## 2. 需求领域
### 2.1 {{Requirement Area 1}}
#### REQ-{{area}}-001: {{Requirement Title}}
- **类型**: EARS模式类型
- **描述**: EARS格式的需求描述
- **验收标准**:
  - Given: ...
  - When: ...
  - Then: ...

#### REQ-{{area}}-002: ...

### 2.2 {{Requirement Area 2}}
...

## 3. 非功能性需求
### 3.1 性能
### 3.2 可维护性
### 3.3 兼容性

## 4. 约束与假设
### 4.1 技术约束
### 4.2 假设

## 5. 术语表
```

## Writing Guidelines
1. Use EARS patterns for all functional requirements
2. Each requirement has a unique ID (REQ-AREA-NNN)
3. Group related requirements into logical areas
4. Include acceptance criteria for every requirement
5. Focus on WHAT, not HOW
6. Requirements must be testable and verifiable
