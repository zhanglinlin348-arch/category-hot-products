
const $ = id => document.getElementById(id);

let products = [];
let excelRows = [];

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[c]));
}

// 自动为后台 API 请求附加管理员登录凭证
async function api(url, opts = {}) {
  const isAdminApi = url.startsWith('/api/admin/');

  if (isAdminApi) {
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session?.access_token;

    if (!token) throw new Error('请先登录管理员账号');

    opts.headers = {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`
    };
  }

  const r = await fetch(url, opts);
  let d = {};
  try { d = await r.json(); } catch {}

  if (!r.ok) throw new Error(d.error || `请求失败 (${r.status})`);
  return d;
}

// 登录界面
function showLogin(message = '') {
  document.querySelector('.admin-wrap').style.display = 'none';

  let gate = $('authGate');

  if (!gate) {
    document.body.insertAdjacentHTML('afterbegin', `
      <style>
        #authGate {
          position:fixed; inset:0; z-index:9999;
          display:flex; align-items:center; justify-content:center;
          background:#f4f6f9; padding:20px;
        }
        .auth-card {
          width:100%; max-width:390px; background:white;
          padding:32px; border-radius:14px;
          box-shadow:0 8px 35px #00000012;
        }
        .auth-card h2 { margin:0 0 8px; }
        .auth-card p { color:#777; font-size:14px; }
        .auth-card input {
          box-sizing:border-box; width:100%; padding:12px;
          margin:8px 0; border:1px solid #ddd; border-radius:7px;
        }
        .auth-card button {
          width:100%; padding:12px; margin-top:12px;
          background:#202b46; color:white; border:0;
          border-radius:7px; cursor:pointer;
        }
        #authMessage { color:#c0392b; min-height:22px; }
      </style>
      <div id="authGate">
        <form class="auth-card" id="loginForm">
          <h2>管理员登录</h2>
          <p>登录后才能导入商品、上传图片和管理商品。</p>
          <input id="loginEmail" type="email"
            placeholder="管理员邮箱" required>
          <input id="loginPassword" type="password"
            placeholder="管理员密码" required>
          <div id="authMessage"></div>
          <button id="loginButton" type="submit">登录</button>
        </form>
      </div>
    `);

    $('loginForm').addEventListener('submit', async e => {
      e.preventDefault();

      const button = $('loginButton');
      const message = $('authMessage');

      button.disabled = true;
      button.textContent = '正在登录…';
      message.textContent = '';

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: $('loginEmail').value.trim(),
          password: $('loginPassword').value
        });

        if (error) throw error;

        if (data.user?.app_metadata?.role !== 'admin') {
          await supabaseClient.auth.signOut();
          throw new Error('此账号没有管理员权限');
        }

        $('authGate').remove();
        document.querySelector('.admin-wrap').style.display = '';
        addLogoutButton();
        await load();

      } catch (err) {
        message.textContent = err.message || '登录失败';
      } finally {
        button.disabled = false;
        button.textContent = '登录';
      }
    });
  }

  $('authMessage').textContent = message;
}

function addLogoutButton() {
  if ($('logoutAdmin')) return;

  const actions = document.querySelector('.top-actions');
  const button = document.createElement('button');

  button.id = 'logoutAdmin';
  button.textContent = '退出登录';
  button.className = 'secondary-btn';

  button.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  actions.appendChild(button);
}

// 加载商品
async function load() {
  try {
    products = (await api('/api/public/data')).products || [];
    render();
  } catch (e) {
    $('adminList').textContent = e.message;
  }
}

// 渲染商品列表
function render() {
  const q = $('adminSearch').value.trim().toLowerCase();

  const rows = products.filter(p =>
    [p.product_name, p.leaf_category, p.category3, p.category4]
      .some(v => (v || '').toLowerCase().includes(q))
  );

  $('adminCount').textContent = `共 ${products.length} 件`;

  $('adminList').innerHTML = rows.length
    ? rows.map(p => `
      <div class="admin-row" data-id="${esc(p.id)}">
        <img class="admin-thumb" src="${esc(p.image_url || '')}"
          onerror="this.style.visibility='hidden'">
        <div>
          <div class="admin-name">${esc(p.product_name)}</div>
          <div class="admin-meta">
            ${esc(p.category3)} / ${esc(p.category4)} / ${esc(p.leaf_category)}
          </div>
        </div>
        <label>优先级<br>
          <input class="priority-input" type="number" min="1"
            value="${p.priority}">
        </label>
        <label class="makeover-control">
          <input class="makeover-input" type="checkbox"
            ${p.makeover ? 'checked' : ''}> 改款标签
        </label>
        <label class="upload-control">
          <input class="image-input" type="file" accept="image/*" hidden>
          <button class="upload-btn">上传图片</button>
        </label>
        <button class="delete-control danger">删除</button>
      </div>
    `).join('')
    : '<div class="empty">暂无商品</div>';

  bindRows();
}

function bindRows() {
  document.querySelectorAll('.admin-row').forEach(row => {
    const id = row.dataset.id;

    row.querySelector('.priority-input')
      .addEventListener('change', () => save(row));

    row.querySelector('.makeover-input')
      .addEventListener('change', () => save(row));

    const file = row.querySelector('.image-input');

    row.querySelector('.upload-btn')
      .addEventListener('click', () => file.click());

    file.addEventListener('change', async () => {
      if (!file.files[0]) return;

      const fd = new FormData();
      fd.append('id', id);
      fd.append('image', file.files[0]);

      try {
        await api('/api/admin/upload', {
          method: 'POST',
          body: fd
        });
        await load();
        alert('图片上传成功');
      } catch (e) {
        alert(e.message);
      }
    });

    row.querySelector('.delete-control')
      .addEventListener('click', async () => {
        if (!confirm('确定删除这张商品卡片吗？')) return;

        try {
          await api('/api/admin/item', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          await load();
        } catch (e) {
          alert(e.message);
        }
      });
  });
}

// 保存优先级和改款标签
async function save(row) {
  try {
    await api('/api/admin/item', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: row.dataset.id,
        priority: row.querySelector('.priority-input').value,
        makeover: row.querySelector('.makeover-input').checked
      })
    });

    const p = products.find(x => x.id === row.dataset.id);

    if (p) {
      p.priority = Number(row.querySelector('.priority-input').value) || 999;
      p.makeover = row.querySelector('.makeover-input').checked ? 1 : 0;
      p.updated_at = new Date().toISOString();
    }
  } catch (e) {
    alert(e.message);
  }
}

// 识别 Excel 列
function normalizeRows(json) {
  if (!json.length) return [];

  const headers = Object.keys(json[0]);
  const find = (...names) =>
    headers.find(h => names.includes(String(h).trim().toLowerCase()));

  const h3 = find('三级类目', 'category3', '三级类目名称');
  const h4 = find('四级类目', 'category4', '四级类目名称');
  const hl = find('叶子类目', 'leaf_category', '叶子类目名称');
  const hn = find('商品名称', '产品名称', 'product_name', '商品');
  const hi = find('图片地址', '图片链接', 'image_url');
  const hp = find('优先级', 'priority');
  const hm = find('改款', '改款标签', 'makeover');

  if (!hl || !hn) {
    throw new Error('Excel 必须包含“叶子类目”和“商品名称”两列');
  }

  return json.map(r => ({
    category3: r[h3] || '',
    category4: r[h4] || '',
    leaf_category: r[hl] || '',
    product_name: r[hn] || '',
    image_url: r[hi] || '',
    priority: Number(r[hp]) || 999,
    makeover: r[hm] || ''
  })).filter(r =>
    String(r.leaf_category).trim() &&
    String(r.product_name).trim()
  );
}

// 选择 Excel 文件
$('excelFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json(
      wb.Sheets[wb.SheetNames[0]], { defval: '' }
    );

    excelRows = normalizeRows(rows);

    $('excelStatus').textContent =
      `已读取 ${excelRows.length} 行有效商品数据。`;

    $('importBtn').disabled = !excelRows.length;

  } catch (err) {
    excelRows = [];
    $('excelStatus').textContent = err.message;
    $('importBtn').disabled = true;
  }
});

// 导入 Excel
$('importBtn').addEventListener('click', async () => {
  if (!excelRows.length) return;

  $('importBtn').disabled = true;
  $('excelStatus').textContent = '正在导入…';

  try {
    const d = await api('/api/admin/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: excelRows })
    });

    $('excelStatus').textContent = `导入成功：${d.imported} 行。`;
    await load();

  } catch (e) {
    $('excelStatus').textContent = '导入失败：' + e.message;
  } finally {
    $('importBtn').disabled = false;
  }
});

$('adminSearch').addEventListener('input', render);
$('reloadAdmin').addEventListener('click', load);

// 初始化：检查是否已有管理员登录
async function init() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    showLogin('Supabase 配置缺失，请检查 supabase-config.js');
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    const session = data.session;

    if (session?.user?.app_metadata?.role === 'admin') {
      $('adminList').textContent = '正在加载…';
      addLogoutButton();
      await load();
    } else {
      if (session) await supabaseClient.auth.signOut();
      showLogin();
    }
  } catch (e) {
    showLogin(e.message);
  }
}

init();
