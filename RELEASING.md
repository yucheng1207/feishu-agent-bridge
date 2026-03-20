# 发布到 npm

1. 确保版本号已更新（`package.json` 的 `version`，当前双模式为 **1.1.0**）。
2. 构建与检查：
   ```bash
   npm run build && npm run typecheck
   ```
3. 登录 npm（首次）：
   ```bash
   npm login
   ```
4. 发布：
   ```bash
   npm publish
   ```

发布后，在 **cursor-agent** 目录执行 `npm install` 即可解析 `cursor-feishu@^1.1.0`。

若 `cursor-agent` 的 `npm install` 报 `No matching version for cursor-feishu@^1.1.0`，说明尚未发布成功，请先完成步骤 4。
