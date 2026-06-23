# 今天吃点啥

面向家庭场景的移动优先点菜与冰箱管理工具。当前包含：

- 家常菜录入、分类、编辑、菜谱链接复制和随机搭配
- 菜单确认、库存自动比对、缺失食材一键加入采购清单
- 餐馆与外卖店铺录入、评分、条件随机和分享
- 冰箱库存、到期日期、批量清理、采购提醒走马灯
- 全局食材标准词条联想；所有数据默认保存在浏览器 localStorage

## 本地运行

```bash
npm install
npm run dev
```

## Netlify 部署

仓库已包含 `netlify.toml`。连接仓库后，Netlify 会运行 `npm run build` 并发布 `dist`。

## Supabase

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 复制 `.env.example` 为 `.env`，填写项目 URL 和 anon key。
3. `src/supabase.js` 会在配置存在时初始化客户端。

当前版本为了开箱即用，业务读写使用 localStorage。正式多人家庭共享前，应接入 Supabase Auth、家庭成员关系和 RLS，再将 `src/store.js` 的读写替换为云端仓储层；不要在生产环境关闭 RLS 或开放匿名全表访问。
