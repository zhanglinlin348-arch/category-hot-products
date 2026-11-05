export async function isAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) return false;

  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secretKey = env.SUPABASE_SECRET_KEY || '';

  if (!supabaseUrl || !secretKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': secretKey,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) return false;

    const user = await response.json();
    return user.app_metadata?.role === 'admin';
  } catch {
    return false;
  }
}
