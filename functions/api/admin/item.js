
import { isAdmin } from '../../_lib/auth.js';

export async function onRequestPatch({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return Response.json(
      { error: '需要管理员登录或没有管理员权限' },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '无效的数据格式' }, { status: 400 });
  }

  const id = String(body.id || '');
  if (!id) {
    return Response.json({ error: '缺少商品ID' }, { status: 400 });
  }

  const site = Object.hasOwn(body, 'site')
    ? String(body.site ?? '').trim()
    : null;

  const businessMode = Object.hasOwn(body, 'business_mode')
    ? String(body.business_mode ?? '').trim()
    : null;

  if (
    businessMode !== null &&
    !['', '全托', '半托'].includes(businessMode)
  ) {
    return Response.json(
      { error: '业务模式只能选择全托或半托' },
      { status: 400 }
    );
  }

  // 售价：允许空值，非空时必须是大于等于 0 的数字
  let price = null;
  const hasPrice = Object.hasOwn(body, 'price');

  if (hasPrice && body.price !== null && body.price !== '') {
    price = Number(body.price);

    if (!Number.isFinite(price) || price < 0) {
      return Response.json(
        { error: '售价必须是大于或等于 0 的数字' },
        { status: 400 }
      );
    }
  }

  // 预估日销：允许空值，非空时必须是大于等于 0 的整数
  let estimatedDailySales = null;
  const hasDailySales = Object.hasOwn(body, 'estimated_daily_sales');

  if (
    hasDailySales &&
    body.estimated_daily_sales !== null &&
    body.estimated_daily_sales !== ''
  ) {
    estimatedDailySales = Number(body.estimated_daily_sales);

    if (
      !Number.isInteger(estimatedDailySales) ||
      estimatedDailySales < 0
    ) {
      return Response.json(
        { error: '预估日销必须是大于或等于 0 的整数' },
        { status: 400 }
      );
    }
  }

  await env.DB.prepare(`
    UPDATE products
    SET priority = ?,
        makeover = ?,
        site = COALESCE(?, site),
        business_mode = COALESCE(?, business_mode),
        price = CASE WHEN ? = 1 THEN ? ELSE price END,
        estimated_daily_sales = CASE WHEN ? = 1 THEN ? ELSE estimated_daily_sales END,
        updated_at = ?
    WHERE id = ?
  `).bind(
    Math.max(1, Number(body.priority) || 999),
    body.makeover ? 1 : 0,
    site,
    businessMode,
    hasPrice ? 1 : 0,
    price,
    hasDailySales ? 1 : 0,
    estimatedDailySales,
    new Date().toISOString(),
    id
  ).run();

  return Response.json({ success: true });
}

export async function onRequestDelete({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return Response.json(
      { error: '需要管理员登录或没有管理员权限' },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '无效的数据格式' }, { status: 400 });
  }

  const id = String(body.id || '');
  if (!id) {
    return Response.json({ error: '缺少商品ID' }, { status: 400 });
  }

  await env.DB.prepare(
    'DELETE FROM products WHERE id = ?'
  ).bind(id).run();

  return Response.json({ success: true });
}
