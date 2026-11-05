export async function onRequestGet({ env }) {
  const { results = [] } = await env.DB.prepare(
    `SELECT id, category3, category4, leaf_category, product_name, image_url, priority, makeover, updated_at
     FROM products ORDER BY priority ASC, updated_at DESC`
  ).all();
  return Response.json({ products: results });
}
