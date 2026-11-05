import { isAdmin } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return Response.json({ error: '需要管理员登录或没有管理员权限' }, { status: 401 });
  }

  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secretKey = env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    return Response.json({ error: 'Supabase 配置缺失' }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get('image');
  const id = String(form.get('id') || '');

  if (!file || !id || typeof file.size !== 'number') {
    return Response.json({ error: '缺少图片或商品ID' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return Response.json({ error: '只支持图片文件' }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: '图片不能超过8MB' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || 'jpg')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase() || 'jpg';

  const key = `${crypto.randomUUID()}.${ext}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${key}`;

  try {
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': secretKey,
        'Content-Type': file.type,
        'Cache-Control': 'max-age=3600',
        'x-upsert': 'true'
      },
      body: file
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return Response.json({
        error: 'Supabase 图片上传失败',
        details: errorText.slice(0, 500)
      }, { status: 502 });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${key}`;

    await env.DB.prepare(
      'UPDATE products SET image_url=?, updated_at=? WHERE id=?'
    ).bind(publicUrl, new Date().toISOString(), id).run();

    return Response.json({ success: true, image_url: publicUrl });

  } catch (error) {
    return Response.json({
      error: '图片上传过程发生错误',
      details: String(error.message || error)
    }, { status: 500 });
  }
}
