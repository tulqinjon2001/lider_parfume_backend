const crypto = require('crypto');
const { getPool } = require('./db');

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand || '',
    category: row.category || '',
    sizes: row.sizes || [],
    variants: row.variants || [],
  };
}

function getPositivePrices(product) {
  return [
    ...(product.sizes || []).map((s) => Number(s.price) || 0),
    ...(product.variants || []).map((v) => Number(v.price) || 0),
  ].filter((n) => n > 0);
}

function isProductVisibleToCustomers(product) {
  if (!product.variants?.length) return false;
  return getPositivePrices(product).length > 0;
}

function filterProductsForCustomers(products) {
  return products.filter(isProductVisibleToCustomers);
}

async function readProducts() {
  const { rows } = await getPool().query(
    'SELECT id, name, brand, category, sizes, variants FROM products ORDER BY id'
  );
  return rows.map(mapProduct);
}

async function upsertProductRow(client, p) {
  await client.query(
    `INSERT INTO products (id, name, brand, category, sizes, variants, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       brand = EXCLUDED.brand,
       category = EXCLUDED.category,
       sizes = EXCLUDED.sizes,
       variants = EXCLUDED.variants,
       updated_at = EXCLUDED.updated_at`,
    [
      p.id,
      p.name,
      p.brand || '',
      p.category || '',
      JSON.stringify(p.sizes || []),
      JSON.stringify(p.variants || []),
      new Date().toISOString(),
    ]
  );
}

async function readProductById(id) {
  const { rows } = await getPool().query(
    'SELECT id, name, brand, category, sizes, variants FROM products WHERE id = $1',
    [id]
  );
  return rows[0] ? mapProduct(rows[0]) : null;
}

async function getNextProductId() {
  const { rows } = await getPool().query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM products');
  return rows[0].next_id;
}

async function upsertProduct(product) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await upsertProductRow(client, product);
    await client.query('COMMIT');
    return product;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteProductById(id) {
  const { rowCount } = await getPool().query('DELETE FROM products WHERE id = $1', [id]);
  return rowCount > 0;
}

async function writeProducts(products) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query('SELECT id FROM products');
    const newIds = new Set(products.map((p) => p.id));
    const toDelete = existing.map((r) => r.id).filter((id) => !newIds.has(id));

    if (toDelete.length) {
      await client.query('DELETE FROM products WHERE id = ANY($1::int[])', [toDelete]);
    }

    for (const p of products) {
      await upsertProductRow(client, p);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function nextProductId(products) {
  return products.length ? Math.max(...products.map((p) => p.id)) + 1 : 1;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeVariantId(productId, scent, size) {
  return `${productId}-${slugify(scent)}-${slugify(size)}`;
}

const adminTokens = new Map();
const TOKEN_TTL = 24 * 60 * 60 * 1000;

function createToken() {
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now() + TOKEN_TTL);
  return token;
}

function verifyToken(token) {
  if (!token) return false;
  const expires = adminTokens.get(token);
  if (!expires) return false;
  if (Date.now() > expires) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Kirish kerak' });
  }
  next();
}

module.exports = {
  readProducts,
  readProductById,
  getNextProductId,
  upsertProduct,
  deleteProductById,
  writeProducts,
  nextProductId,
  slugify,
  makeVariantId,
  createToken,
  verifyToken,
  authMiddleware,
  isProductVisibleToCustomers,
  filterProductsForCustomers,
};
