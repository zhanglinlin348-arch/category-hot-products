
let allProducts = [];
let selected = null;
let expanded = new Set();
let search = '';

let imagePreview = null;
let activePreviewImage = null;

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

// ==============================
// 商品图片点击放大
// ==============================

function hideImagePreview() {
  activePreviewImage = null;

  if (imagePreview) {
    imagePreview.style.display = 'none';
  }
}

function showImagePreview(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;

  const container = img.closest('.product-image');
  if (!container) return;

  const rect = container.getBoundingClientRect();

  // 放大两倍，限制在浏览器可视范围内
  const maxW = Math.min(
    rect.width * 2,
    window.innerWidth * 0.85
  );

  const maxH = Math.min(
    rect.height * 2,
    window.innerHeight * 0.85
  );

  // 保持图片原始比例
  const scale = Math.min(
    maxW / img.naturalWidth,
    maxH / img.naturalHeight
  );

  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;

  imagePreview.src = img.currentSrc || img.src;
  imagePreview.style.width = width + 'px';
  imagePreview.style.height = height + 'px';

  // 默认显示在商品图片右侧
  let left = rect.right + 12;
  let top = rect.top + (rect.height - height) / 2;

  // 右侧空间不足，显示在左侧
  if (left + width > window.innerWidth - 10) {
    left = rect.left - width - 12;
  }

  // 左侧也放不下，尽量靠近原图
  if (left < 10) {
    left = Math.max(
      10,
      Math.min(rect.left, window.innerWidth - width - 10)
    );
  }

  // 防止超出页面上下边缘
  top = Math.max(
    10,
    Math.min(top, window.innerHeight - height - 10)
  );

  imagePreview.style.left = left + 'px';
  imagePreview.style.top = top + 'px';
  imagePreview.style.display = 'block';
}

function setupImageClickPreview() {
  const cards = $('cards');

  if (!cards || imagePreview) return;

  imagePreview = document.createElement('img');
  imagePreview.className = 'image-hover-preview';
  imagePreview.alt = '商品图片放大预览';
  imagePreview.title = '点击图片关闭预览';

  document.body.appendChild(imagePreview);

  // 点击商品图片：放大或恢复
  cards.addEventListener('click', event => {
    const img = event.target.closest('.product-image img');

    if (!img || !cards.contains(img)) return;

    event.stopPropagation();

    // 再次点击同一张图片，关闭放大
    if (activePreviewImage === img) {
      hideImagePreview();
      return;
    }

    activePreviewImage = img;

    // 图片已加载，直接显示
    if (img.complete && img.naturalWidth) {
      showImagePreview(img);
    } else {
      imagePreview.style.display = 'none';

      img.addEventListener('load', () => {
        if (activePreviewImage === img) {
          showImagePreview(img);
        }
      }, { once: true });
    }
  });

  // 点击放大图片本身，关闭预览
  imagePreview.addEventListener('click', event => {
    event.stopPropagation();
    hideImagePreview();
  });

  // 点击页面其他位置，关闭预览
  document.addEventListener('click', event => {
    if (imagePreview.contains(event.target)) return;
    if (event.target.closest('.product-image img')) return;

    hideImagePreview();
  });

  // 页面滚动、窗口切换或尺寸变化时关闭预览
  window.addEventListener('scroll', hideImagePreview, true);
  window.addEventListener('blur', hideImagePreview);
  window.addEventListener('resize', hideImagePreview);
}

// ==============================
// 数据加载
// ==============================

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

// ==============================
// 类目树
// ==============================

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
  const searchResults = q ? getSearchResults() : [];

  let html = '';

  for (const [a, lv4] of Object.entries(root)) {
    const keyA = 'a:' + a;
    const openA = expanded.has(keyA) || !!search;

    const matchedA = !q || searchResults.some(p =>
      categoryPath(p)[0] === a
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

        const matchedB = !q || searchResults.some(p =>
          categoryPath(p)[0] === a &&
          categoryPath(p)[1] === b
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
            const matchedC = !q || searchResults.some(p =>
              categoryPath(p)[0] === a &&
              categoryPath(p)[1] === b &&
              categoryPath(p)[2] === c
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

      if (selected?.type === type && selected?.value === value) {
        selected = null;
      } else {
        selected = { type, value };
      }

      renderTree();
      renderCards();
    });
  });
}

// ==============================
// 商品卡片
// ==============================

function renderCards() {
  hideImagePreview();

  let rows = [...allProducts];

  const businessMode = $('businessModeFilter').value;

  if (businessMode) {
    rows = rows.filter(p =>
      (p.business_mode || '') === businessMode
    );
  }

  if (search) {
    const searchResults = getSearchResults();

    rows = rows.filter(p => searchResults.includes(p));

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

          <div class="crumb">
            ${esc(p.category3)} / ${esc(p.category4)} / ${esc(p.leaf_category)}
          </div>

          <div class="crumb">
            站点：${esc(p.site || '未设置')}
          </div>

          <div class="crumb">
            业务模式：${esc(p.business_mode || '未设置')}
          </div>

          <div class="crumb">
            售价：${p.price !== null && p.price !== undefined && p.price !== ''
              ? '$' + Number(p.price).toFixed(2)
              : '未设置'}
          </div>

          <div class="crumb">
            预估日销：${p.estimated_daily_sales !== null && p.estimated_daily_sales !== undefined && p.estimated_daily_sales !== ''
              ? Number(p.estimated_daily_sales) + ' 件/天'
              : '未设置'}
          </div>

          <div class="card-foot">
            <span>商品灵感</span>
            <span>${date(p.updated_at)}</span>
          </div>
        </div>
      </article>
    `).join('')
    : '<div class="empty">当前条件下暂无商品</div>';
}

// ==============================
// 通用辅助函数
// ==============================

function date(s) {
  return s
    ? new Date(s).toLocaleDateString('zh-CN')
    : '—';
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

// ==============================
// 页面事件
// ==============================

$('searchInput').addEventListener('input', e => {
  search = e.target.value.trim();

  if (search) {
    selected = null;
    expanded.clear();
    updateSearchExpansion();
  }

  if (!search) {
    selected = null;
    expanded.clear();
  }

  renderTree();
  renderCards();
});

$('sortSelect').addEventListener('change', renderCards);

$('businessModeFilter').addEventListener('change', renderCards);

$('refreshBtn').addEventListener('click', load);

$('expandAll').addEventListener('click', () => {
  for (const p of allProducts) {
    const [a, b] = categoryPath(p);

    expanded.add('a:' + a);
    expanded.add('b:' + a + '|' + b);
  }

  renderTree();
});

// ==============================
// 页面初始化
// ==============================

setupImageClickPreview();

load();

setInterval(load, 60000);
