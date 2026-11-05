import { isAdmin } from '../../_lib/auth.js';

export async function onRequestPatch({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return Response.json({ error: '需要管理员登录或没有管理员权限' }, { status: 401 });
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
    'UPDATE products SET priority=?, makeover=?, updated_at=? WHERE id=?'
  ).bind(
    Math.max(1, Number(body.priority) || 999),
    body.makeover ? 1 : 0,
    new Date().toISOString(),
    id
  ).run();

  return Response.json({ success: true });
}

export async function onRequestDelete({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return Response.json({ error: '需要管理员登录或没有管理员权限' }, { status: 401 });
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

  await env.DB.prepare('DELETE FROM products WHERE id=?').bind(id).run();

  return Response.json({ success: true });
}
