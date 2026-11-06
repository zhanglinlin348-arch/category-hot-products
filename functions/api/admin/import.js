
import { checkAdmin } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  // 第一步：验证管理员身份
  const auth = await checkAdmin(request, env);

  if (!auth.ok) {
    return Response.json({
      error: '管理员验证失败',
      diagnostic: auth.reason
    }, { status: 401 });
  }

  // 第二步：读取 Excel 转换后的数据
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({
      error: '无效的数据格式'
    }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];

  if (!rows.length) {
    return Response.json({
      error: '没有可导入的数据'
    }, { status: 400 });
  }

  // 第三步：整理商品数据
  const now = new Date().toISOString();

  const statements = rows.map((r) => {
    const category3 = String(r.category3 || '').trim();
    const category4 = String(r.category4 || '').trim();
    const leaf = String(r.leaf_category || '').trim();
    const name = String(r.product_name || '').trim();

    if (!leaf || !name) return null;

    const id = crypto.randomUUID();

    return env.DB.prepare(`
      INSERT INTO products (
        id,
        category3,
        category4,
        leaf_category,
        product_name,
        image_url,
        priority,
        makeover,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

      ON CONFLICT(leaf_category, product_name)
      DO UPDATE SET
        category3 = excluded.category3,
        category4 = excluded.category4,
        image_url = CASE
          WHEN excluded.image_url <> ''
          THEN excluded.image_url
          ELSE products.image_url
        END,
        priority = excluded.priority,
        makeover = excluded.makeover,
        updated_at = excluded.updated_at
    `).bind(
      id,
      category3,
      category4,
      leaf,
      name,
      String(r.image_url || '').trim(),
      Number(r.priority) || 999,
      (
        r.makeover === true ||
        String(r.makeover).toLowerCase() === 'true' ||
        String(r.makeover) === '1' ||
        String(r.makeover) === '是'
      ) ? 1 : 0,
      now,
      now
    );
  }).filter(Boolean);

  // 第四步：检查有效数据
  if (!statements.length) {
    return Response.json({
      error: '请至少提供叶子类目和商品名称'
    }, { status: 400 });
  }

  // 第五步：写入 D1 数据库
  try {
    await env.DB.batch(statements);

    return Response.json({
      success: true,
      imported: statements.length
    });

  } catch (error) {
    return Response.json({
      error: '商品导入失败，请检查数据格式或数据库',
      detail: error.message
    }, { status: 500 });
  }
}
