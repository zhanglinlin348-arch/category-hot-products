
export async function checkAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) return { ok: false, reason: 'NO_TOKEN' };

  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secretKey = env.SUPABASE_SECRET_KEY || '';

  if (!supabaseUrl || !secretKey) {
    return { ok: false, reason: 'MISSING_CONFIG' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const detail = (await response.text()).toLowerCase();

      if (detail.includes('api key')) {
        return { ok: false, reason: 'INVALID_SECRET_KEY' };
      }

      if (detail.includes('jwt') || detail.includes('token')) {
        return { ok: false, reason: 'INVALID_OR_EXPIRED_TOKEN' };
      }

      return { ok: false, reason: `SUPABASE_ERROR_${response.status}` };
    }

    const user = await response.json();

    if (user.app_metadata?.role !== 'admin') {
      return { ok: false, reason: 'ADMIN_ROLE_MISSING' };
    }

    return { ok: true };

  } catch {
    return { ok: false, reason: 'NETWORK_ERROR' };
  }
}

export async function isAdmin(request, env) {
  const result = await checkAdmin(request, env);
  return result.ok;
}
