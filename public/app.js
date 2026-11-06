
let allProducts = [];
let selected = null;
let expanded = new Set();
let search = '';

const $ = id => document.getElementById(id);

function norm(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function categoryPath(p) {
  return [
    p.category3 || '未分类',
    p.category4 || '未分类',
    p.leaf_category || '未分类'
  ];
}

async function load() {
  try {
    const r = await fetch('/api/public/data');
    if (!r.ok) throw new Error('数据请求失败');

    const d = await r.json();
    allProducts = d.products || [];

    renderTree();
    renderCards();
  } catch (e) {
    $('cards').innerHTML =
      '<div class="empty">数据加载失败，请稍后刷新</div>';
  }
}

function treeData() {
  const root = {};

  for (const p of allProducts) {
    const [a, b, c] = categoryPath(p);

    root[a] ??= {};
    root[a][b] ??= new Set();
    root[a][b].add(c);
  }

  return root;
}

// 获取搜索匹配的商品，并自动展开对应类目
function getSearchResults() {
  const q = norm(search);

  if (!q) return [];

  return allProducts.filter(p => {
    const fields = [
      p.category3,
      p.category4,
      p.leaf_category,
      p.product_name
    ];

    return fields.some(value => norm(value).includes(q));
  });
}

function updateSearchExpansion() {
  if (!search) return;

  const matches = getSearchResults();

  for (const p of matches) {
    const [a, b] = categoryPath(p);

    expanded.add('a:' + a);
    expanded.add('b:' + a + '|' + b);
  }
}

function renderTree() {
  const root = treeData();

  const count = new Set(
    allProducts.map(p => p.leaf_category || '未分类')
  ).size;

  $('categoryCount').textContent =
    `${Object.keys(root).length} 个三级类目 · ${count} 个叶子类目`;

  updateSearchExpansion();

  const q = norm(search);
  let html = '';

  for (const [a, lv4] of Object.entries(root)) {
    const keyA = 'a:' + a;

    const openA = expanded.has(keyA) || !!search;

    // 搜索时只显示有匹配商品的分支
    const matchedA = !q || allProducts.some(p =>
      categoryPath(p)[0] === a &&
      getSearchResults().includes(p)
    );

    if (!matchedA) continue;

    html += `<div class="tree-node">
      <div class="tree-label ${selected?.type === 'a' && selected.value === a ? 'active' : ''}"
        data-type="a" data-value="${esc(a)}">
        <span class="tree-toggle">${openA ? '▼' : '▶'}</span>
        <b>${esc(a)}</b>
      </div>`;

    if (openA) {
      html += '<div class="tree-children">';

      for (const [b, leaves] of Object.entries(lv4)) {
        const keyB = 'b:' + a + '|' + b;
        const openB = expanded.has(keyB) || !!search;

        const matchedB = !q || allProducts.some(p =>
          categoryPath(p)[0] === a &&
          categoryPath(p)[1] === b &&
          getSearchResults().includes(p)
        );

        if (!matchedB) continue;

        html += `<div class="tree-node">
          <div class="tree-label ${selected?.type === 'b' && selected.value === a + '|' + b ? 'active' : ''}"
            data-type="b" data-value="${esc(a + '|' + b)}">
            <span class="tree-toggle">${openB ? '▼' : '▶'}</span>
            ${esc(b)}
          </div>`;

        if (openB) {
          html += '<div class="tree-children">';

          for (const c of leaves) {
            const matchedC = !q || allProducts.some(p =>
              categoryPath(p)[0] === a &&
              categoryPath(p)[1] === b &&
              categoryPath(p)[2] === c &&
              getSearchResults().includes(p)
            );

            if (!matchedC) continue;

            const active =
              selected?.type === 'c' &&
              selected.value === a + '|' + b + '|' + c;

            html += `<div class="tree-label ${active ? 'active' : ''}"
              data-type="c" data-value="${esc(a + '|' + b + '|' + c)}">
              <span class="tree-toggle">•</span>${esc(c)}
            </div>`;
          }

          html += '</div>';
        }

        html += '</div>';
      }

      html += '</div>';
    }

    html += '</div>';
  }

  $('tree').innerHTML = html ||
    '<div class="empty">没有匹配的类目</div>';

  $('tree').querySelectorAll('.tree-label').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      const value = el.dataset.value;

      // 点击类目时清除搜索词，避免条件叠加
      search = '';
      $('searchInput').value = '';

      if (type === 'a') {
        const k = 'a:' + value;
        expanded.has(k)
          ? expanded.delete(k)
          : expanded.add(k);
      }

      if (type === 'b') {
        const k = 'b:' + value;
        expanded.has(k)
          ? expanded.delete(k)
          : expanded.add(k);
      }

      selected = { type, value };

      renderTree();
      renderCards();
    });
  });
}

function renderCards() {
  let rows = [...allProducts];

  // 搜索时不再叠加旧的类目筛选
  if (search) {
    rows = getSearchResults();
  } else if (selected) {
    const v = selected.value.split('|');

    rows = rows.filter(p => {
      const [c3, c4, leaf] = categoryPath(p);

      if (selected.type === 'a') return c3 === v[0];

      if (selected.type === 'b') {
        return c3 === v[0] && c4 === v[1];
      }

      return c3 === v[0] &&
        c4 === v[1] &&
        leaf === v[2];
    });
  }

  const sort = $('sortSelect').value;

  rows.sort((a, b) =>
    sort === 'priority'
      ? (Number(a.priority || 999) - Number(b.priority || 999))
      : (new Date(b.updated_at) - new Date(a.updated_at))
  );

  $('heading').textContent = search
    ? '搜索结果'
    : selected
      ? selected.value.split('|').at(-1)
      : '全部爆款商品';

  $('subheading').textContent = search
    ? `关键词：${search}`
    : selected
      ? '当前类目下的商品与改款机会'
      : '按类目浏览商品灵感与改款机会';

  $('activePath').innerHTML = search
    ? `<span class="chip">搜索：${esc(search)}</span>`
    : selected
      ? selected.value.split('|')
          .map(x => `<span class="chip">${esc(x)}</span>`)
          .join('')
      : '<span class="chip">全部类目</span>';

  $('resultCount').textContent = `${rows.length} 件商品`;

  $('cards').innerHTML = rows.length
    ? rows.map(p => `
      <article class="product-card">
        <div class="product-image">
          ${p.image_url
            ? `<img src="${esc(p.image_url)}" loading="lazy" alt="${esc(p.product_name)}">`
            : '<span class="no-image">暂无商品图片</span>'}
          ${p.makeover ? '<span class="makeover">改款</span>' : ''}
          <span class="priority">优先级 ${p.priority}</span>
        </div>
        <div class="card-body">
          <div class="card-title">${esc(p.product_name)}</div>
          <div class="crumb">${esc(p.category3)} / ${esc(p.category4)} / ${esc(p.leaf_category)}</div>
          <div class="card-foot">
            <span>商品灵感</span>
            <span>${date(p.updated_at)}</span>
          </div>
        </div>
      </article>
    `).join('')
    : '<div class="empty">当前条件下暂无商品</div>';
}

function date(s) {
  return s ? new Date(s).toLocaleDateString('zh-CN') : '—';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

$('searchInput').addEventListener('input', e => {
  search = e.target.value.trim();

  // 输入关键词时清除此前点击类目产生的筛选
  if (search) {
    selected = null;
    expanded.clear();
    updateSearchExpansion();
  }

  // 清空关键词后恢复全部类目
  if (!search) {
    selected = null;
    expanded.clear();
  }

  renderTree();
  renderCards();
});

$('sortSelect').addEventListener('change', renderCards);
$('refreshBtn').addEventListener('click', load);

$('expandAll').addEventListener('click', () => {
  for (const p of allProducts) {
    const [a, b] = categoryPath(p);
    expanded.add('a:' + a);
    expanded.add('b:' + a + '|' + b);
  }

  renderTree();
});

load();
setInterval(load, 60000);
