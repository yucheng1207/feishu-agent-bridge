# 发布到 npm

1. 确保版本号已更新（`package.json` 的 `version`）。
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

发布后，在 **cursor-agent**（或其它依赖方）目录执行 `npm install`，确保 `package.json` 中为 `feishu-agent-bridge` 的 semver（如 `^1.2.0`），以刷新 `package-lock.json` 中的 registry `resolved` 与 `integrity`。

源码仓库：<https://github.com/yucheng1207/feishu-agent-bridge>

若 `npm install` 报 **No matching version for feishu-agent-bridge**，说明尚未发布成功，请先完成步骤 4。
