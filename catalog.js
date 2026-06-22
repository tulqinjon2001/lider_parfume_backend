const { getPool } = require('./db');

const DEFAULT_CATALOG = {
  brands: [],
  categories: ['Parfyum', 'Shampun', 'Dezodorant', 'Kosmetika'],
};

async function readCatalog() {
  const { rows } = await getPool().query(
    'SELECT brands, categories FROM catalog WHERE id = 1'
  );

  if (!rows.length) return { ...DEFAULT_CATALOG };

  const data = rows[0];
  return {
    brands: data.brands || [],
    categories: data.categories || DEFAULT_CATALOG.categories,
  };
}

async function writeCatalog(catalog) {
  await getPool().query(
    `INSERT INTO catalog (id, brands, categories)
     VALUES (1, $1::jsonb, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       brands = EXCLUDED.brands,
       categories = EXCLUDED.categories`,
    [
      JSON.stringify(catalog.brands || []),
      JSON.stringify(catalog.categories || []),
    ]
  );
}

module.exports = { readCatalog, writeCatalog, DEFAULT_CATALOG };
