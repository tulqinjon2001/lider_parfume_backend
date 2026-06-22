const { getPool } = require('./db');

function normalizeUzPhone(input) {
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('998')) {
    // ok
  } else if (d.startsWith('8') && d.length <= 10) {
    d = `998${d.slice(1)}`;
  } else if (d.length <= 9) {
    d = `998${d}`;
  }
  return d.slice(0, 12);
}

function formatUzPhone(digits) {
  const d = String(digits).slice(0, 12);
  if (!d) return '';
  if (d.length <= 3) return `+${d}`;
  let out = `+${d.slice(0, 3)} ${d.slice(3, 5)}`;
  if (d.length <= 5) return out;
  out += ` ${d.slice(5, 8)}`;
  if (d.length <= 8) return out;
  out += ` ${d.slice(8, 10)}`;
  if (d.length <= 10) return out;
  return `${out} ${d.slice(10, 12)}`;
}

function productKey(item) {
  return [item.name, item.scent || '', item.size || ''].join('\0');
}

function mapOrder(row) {
  return {
    id: row.id,
    phone: row.phone,
    phoneDisplay: formatUzPhone(row.phone),
    name: row.name,
    location: row.location,
    note: row.note,
    paymentType: row.payment_type,
    items: row.items,
    total: Number(row.total),
    createdAt: row.created_at,
  };
}

async function saveOrder(order) {
  const phone = normalizeUzPhone(order.phone);
  if (phone.length !== 12 || !phone.startsWith('998')) {
    throw new Error('Telefon raqami noto\'g\'ri');
  }

  const { rows } = await getPool().query(
    `INSERT INTO orders (phone, name, location, note, payment_type, items, total)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id`,
    [
      phone,
      order.name,
      order.location,
      order.note?.trim() || null,
      order.paymentType,
      JSON.stringify(order.items),
      order.total,
    ]
  );

  return rows[0];
}

async function listCustomers({ search = '', limit = 100 } = {}) {
  const normalized = normalizeUzPhone(search);
  let rows;

  if (search.trim() && normalized.length >= 3) {
    ({ rows } = await getPool().query(
      `SELECT phone, name, total, created_at
       FROM orders
       WHERE phone ILIKE $1
       ORDER BY created_at DESC
       LIMIT 2000`,
      [`${normalized}%`]
    ));
  } else {
    ({ rows } = await getPool().query(
      `SELECT phone, name, total, created_at
       FROM orders
       ORDER BY created_at DESC
       LIMIT 2000`
    ));
  }

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.phone)) {
      map.set(row.phone, {
        phone: row.phone,
        phoneDisplay: formatUzPhone(row.phone),
        name: row.name,
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: row.created_at,
      });
    }
    const customer = map.get(row.phone);
    customer.orderCount += 1;
    customer.totalSpent += Number(row.total);
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt))
    .slice(0, limit);
}

async function getCustomerHistory(phone) {
  const normalized = normalizeUzPhone(phone);
  if (normalized.length !== 12) {
    return null;
  }

  const { rows } = await getPool().query(
    `SELECT * FROM orders
     WHERE phone = $1
     ORDER BY created_at DESC`,
    [normalized]
  );

  if (!rows.length) return null;

  const orders = rows.map(mapOrder);
  const productStats = new Map();

  for (const order of orders) {
    const seenInOrder = new Set();
    for (const item of order.items) {
      const key = productKey(item);
      if (!productStats.has(key)) {
        productStats.set(key, {
          name: item.name,
          scent: item.scent || '',
          size: item.size || '',
          totalQty: 0,
          orderCount: 0,
          totalSpent: 0,
        });
      }
      const stat = productStats.get(key);
      stat.totalQty += Number(item.qty) || 0;
      stat.totalSpent += (Number(item.qty) || 0) * (Number(item.price) || 0);
      if (!seenInOrder.has(key)) {
        stat.orderCount += 1;
        seenInOrder.add(key);
      }
    }
  }

  const products = Array.from(productStats.values())
    .sort((a, b) => b.orderCount - a.orderCount || b.totalQty - a.totalQty);

  return {
    phone: normalized,
    phoneDisplay: formatUzPhone(normalized),
    name: orders[0].name,
    orderCount: orders.length,
    totalSpent: orders.reduce((sum, o) => sum + o.total, 0),
    products,
    orders,
  };
}

module.exports = {
  normalizeUzPhone,
  formatUzPhone,
  saveOrder,
  listCustomers,
  getCustomerHistory,
};
