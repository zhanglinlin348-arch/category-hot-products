function isAdmin(request) { return !!request.headers.get('Cf-Access-Authenticated-User-Email'); }
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request)) return Response.json({ error: '需要管理员登录' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('image');
  const id = String(form.get('id') || '');
  if (!file || !id) return Response.json({ error: '缺少图片或商品ID' }, { status: 400 });
  if (!file.type.startsWith('image/')) return Response.json({ error: '只支持图片文件' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: '图片不能超过8MB' }, { status: 400 });
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const key = `${crypto.randomUUID()}.${ext}`;
  await env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = `/images/${key}`;
  await env.DB.prepare('UPDATE products SET image_url=?, updated_at=? WHERE id=?').bind(url, new Date().toISOString(), id).run();
  return Response.json({ success: true, image_url: url });
}
