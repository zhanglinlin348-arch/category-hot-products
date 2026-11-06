
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

  const now = new Date().toISOString();

  // 第三步：检查数据是否合法
  for (const r of rows) {
    const businessMode = String(r.business_mode || '').trim();

    if (!['', '全托', '半托'].includes(businessMode)) {
      return Response.json({
        error: `商品“${r.product_name || ''}”的业务模式不正确，只能填写全托或半托`
      }, { status: 400 });
    }

    // 售价：允许空值，非空必须是非负数字
    if (r.price !== undefined && r.price !== null && r.price !== '') {
      const price = Number(r.price);

      if (!Number.isFinite(price) || price < 0) {
        return Response.json({
          error: `商品“${r.product_name || ''}”的售价不正确，必须是大于或等于 0 的数字`
        }, { status: 400 });
      }
    }

    // 预估日销：允许空值，非空必须是非负整数
    if (
      r.estimated_daily_sales !== undefined &&
      r.estimated_daily_sales !== null &&
      r.estimated_daily_sales !== ''
    ) {
      const sales = Number(r.estimated_daily_sales);

      if (!Number.isInteger(sales) || sales < 0) {
        return Response.json({
          error: `商品“${r.product_name || ''}”的预估日销不正确，必须是大于或等于 0 的整数`
        }, { status: 400 });
      }
    }
  }

  // 第四步：整理商品数据
  const statements = rows.map((r) => {
    const category3 = String(r.category3 || '').trim();
    const category4 = String(r.category4 || '').trim();
    const leaf = String(r.leaf_category || '').trim();
    const name = String(r.product_name || '').trim();
    const site = String(r.site || '').trim();
    const businessMode = String(r.business_mode || '').trim();

    if (!leaf || !name) return null;

    const id = crypto.randomUUID();

    const hasPrice =
      r.price !== undefined &&
      r.price !== null &&
      r.price !== '';

    const price = hasPrice ? Number(r.price) : null;

    const hasDailySales =
      r.estimated_daily_sales !== undefined &&
      r.estimated_daily_sales !== null &&
      r.estimated_daily_sales !== '';

    const estimatedDailySales = hasDailySales
      ? Number(r.estimated_daily_sales)
      : null;

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
        updated_at,
        site,
        business_mode,
        price,
        estimated_daily_sales
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

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
        site = CASE
          WHEN excluded.site <> ''
          THEN excluded.site
          ELSE products.site
        END,
        business_mode = CASE
          WHEN excluded.business_mode <> ''
          THEN excluded.business_mode
          ELSE products.business_mode
        END,
        price = CASE
          WHEN excluded.price IS NOT NULL
          THEN excluded.price
          ELSE products.price
        END,
        estimated_daily_sales = CASE
          WHEN excluded.estimated_daily_sales IS NOT NULL
          THEN excluded.estimated_daily_sales
          ELSE products.estimated_daily_sales
        END,
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
      now,
      site,
      businessMode,
      price,
      estimatedDailySales
    );
  }).filter(Boolean);

  // 第五步：检查有效数据
  if (!statements.length) {
    return Response.json({
      error: '请至少提供叶子类目和商品名称'
    }, { status: 400 });
  }

  // 第六步：写入 D1 数据库
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
