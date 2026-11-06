export async function isAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    console.error('[admin-auth] Missing bearer token');
    return false;
  }

  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secretKey = env.SUPABASE_SECRET_KEY || '';

  if (!supabaseUrl || !secretKey) {
    console.error('[admin-auth] Missing Supabase environment variable');
    return false;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': secretKey,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(
        '[admin-auth] Supabase rejected request:',
        response.status,
        detail.slice(0, 300)
      );
      return false;
    }

    const user = await response.json();
    const isAdmin = user.app_metadata?.role === 'admin';

    if (!isAdmin) {
      console.error('[admin-auth] User authenticated but admin role is missing');
    }

    return isAdmin;

  } catch (error) {
    console.error('[admin-auth] Verification error:', error.message);
    return false;
  }
}
