# 部署闭环 — 最终文档交付 (2026-06-21 15:10)

## 交付范围
仅部署闭环文档和平台放行准备。不扩到模型、测试隔离、归档指标修订。

## 五项要求逐条确认

### 1. polymarketFusion 断言修正 ✅
- 验收 §3.5：`jq '.polymarketFusion'` → `{"applied": false}`
- 明确标注："不是 null 也不是字段缺失"

### 2. 令牌三级检查 ✅
- .env.example：ADMIN_TOKEN / BOT_API_TOKEN / WRITE_API_TOKEN 全部留空
- 部署指南 §1.3 表：三个令牌均标"不设"
- 验收 §3.4：声明 token 链（bot.js 用 `BOT_API_TOKEN || ADMIN_TOKEN`，prediction.js 用 `WRITE_API_TOKEN || ADMIN_TOKEN`），要求 Railway Variables 逐行确认三者不存在

### 3. 持久卷验收强化 ✅
- 验收 §3.3：Railway Shell → md5sum/文件列表/sentinel → Redeploy → 比对
- 明确警告：/health 和页面在空库时也正常，不能用作持久化证据

### 4. railway.toml 格式待验证 ✅
- railway.toml 注释："格式待平台验证"
- 部署指南 §1.2：标注未验证
- 部署指南 §4：提供 railway.toml 字段验证表格，首次部署后逐项确认

### 5. 发布清单三层分类 ✅
- **C1-C9**：代码与文档层面 ✅（无需平台权限，已完成）
- **A1-A7**：待 GitHub/Railway 授权（创建外部资源）
- **V1-V7**：待真实部署验收（部署完成后逐项打勾）

## 最终状态
- 配置一致性 ✅
- 验收命令可执行 ✅
- railway.toml 标注待验证 ✅
- 清单三分类 ✅
- 不改业务代码 ✅
- 不负责任 ✅
