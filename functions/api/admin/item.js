function isAdmin(request) { return !!request.headers.get('Cf-Access-Authenticated-User-Email'); }
export async function onRequestPatch({ request, env }) {
  if (!isAdmin(request)) return Response.json({ error: '需要管理员登录' }, { status: 401 });
  const body = await request.json();
  const id = String(body.id || '');
  if (!id) return Response.json({ error: '缺少商品ID' }, { status: 400 });
  await env.DB.prepare('UPDATE products SET priority=?, makeover=?, updated_at=? WHERE id=?')
    .bind(Math.max(1, Number(body.priority) || 999), body.makeover ? 1 : 0, new Date().toISOString(), id).run();
  return Response.json({ success: true });
}
export async function onRequestDelete({ request, env }) {
  if (!isAdmin(request)) return Response.json({ error: '需要管理员登录' }, { status: 401 });
  const body = await request.json();
  await env.DB.prepare('DELETE FROM products WHERE id=?').bind(String(body.id || '')).run();
  return Response.json({ success: true });
}
