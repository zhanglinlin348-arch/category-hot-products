# 类目与爆款商品管理系统（Cloudflare Pages）

## 功能
- 三级类目 / 四级类目 / 叶子类目自动生成左侧树形导航
- 首页关键词搜索、类目筛选、优先级和更新时间排序
- Excel 批量导入（按“叶子类目 + 商品名称”匹配更新或新增）
- 管理后台单卡片上传本地图片、设置优先级、切换“改款”标签、删除商品
- D1 保存商品数据，R2 保存图片
- 管理员使用 Cloudflare Access 登录；访客无需登录

## Excel 列名
必填：`三级类目`、`四级类目`、`叶子类目`、`商品名称`
可选：`图片地址`、`优先级`、`改款`
改款列支持：是/否、1/0、true/false。

## 部署步骤
1. 将整个项目上传到 GitHub 仓库。
2. 在 Cloudflare 创建 D1 数据库，名称 `category-hot-products`；复制数据库 ID。
3. 在 Cloudflare 创建 R2 bucket，名称 `category-hot-products-images`。
4. 编辑 `wrangler.toml`，把 `database_id` 替换为真实 D1 ID；R2 bucket 名称保持一致。
5. Cloudflare Pages → Create project → Connect to Git → 选择仓库。Build command 留空，Build output directory 填 `public`。
6. 在 Pages 项目 Settings → Functions → D1 database bindings 中添加变量名 `DB`，绑定刚才的 D1 数据库；在 R2 bucket bindings 中添加变量名 `IMAGES`，绑定 R2 bucket。
7. 初始化 D1 表：在 D1 Console 执行 `migrations/0001_init.sql` 中的 SQL。
8. 在 Cloudflare Zero Trust → Access → Applications 新建 Self-hosted 应用，保护路径 `/admin.html`、`/api/admin/*`，设置允许登录的管理员邮箱。不要保护 `/` 和 `/api/public/*`。
9. 访问 Pages 域名测试：首页公开；`/admin.html` 应要求管理员邮箱验证。
10. 可在 Cloudflare Pages → Custom domains 绑定自己的域名。

## 安全说明
- 访客接口仅提供读取商品列表。
- 写入接口检查 Cloudflare Access 注入的 `Cf-Access-Authenticated-User-Email` 请求头。请务必让 Access 应用覆盖 `/api/admin/*`，不要只保护后台 HTML 页面。
- 该项目是轻量管理系统基础版。正式对外使用前，建议进一步加入图片删除回收、导入预览/回滚、操作日志和更严格的 Access JWT 校验。

## 图片
后台上传图片后保存在 R2，通过 `/images/<文件名>` 访问。图片最大 8MB，仅接受 image 类型。
