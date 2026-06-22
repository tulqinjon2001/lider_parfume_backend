require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  readProducts,
  writeProducts,
  createToken,
  verifyToken,
  authMiddleware,
  filterProductsForCustomers,
} = require('./products');
const { generatePlaceholderSvg, findVariantByImage } = require('./placeholder');
const { readCatalog, writeCatalog } = require('./catalog');
const { saveOrder, listCustomers, getCustomerHistory } = require('./orders');
const { migrate, checkConnection } = require('./db');
const cloudinaryStorage = require('./cloudinary');

const LEGACY_IMAGES_DIR = path.join(__dirname, 'images');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.FRONTEND_URL
  || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isPrivateHost(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return isPrivateHost(hostname);
  } catch {
    return false;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function formatPriceUz(n) {
  return Number(n).toLocaleString('uz-UZ');
}

function formatTelegramOrder({ name, phone, location, paymentLabel, note, items, total }) {
  const divider = '────────────────────';
  const [address, mapsLink] = String(location).split(' | ').map((s) => s.trim());

  const itemBlocks = items.map((item, index) => {
    const detail = [item.scent, item.size].filter(Boolean).join(' · ');
    const subtotal = item.qty * item.price;
    const block = [
      `${index + 1}. ${item.name}`,
      detail ? `   ${detail}` : null,
      `   ${item.qty} ta × ${formatPriceUz(item.price)} so'm`,
      `   Jami: ${formatPriceUz(subtotal)} so'm`,
    ].filter(Boolean);
    return block.join('\n');
  }).join(`\n\n${divider}\n\n`);

  const parts = [
    '🛍 Yangi zakaz — Lider Parfum',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `👤 Ism: ${name}`,
    `📞 Telefon: ${phone}`,
    `📍 Manzil: ${address || location}`,
  ];

  if (mapsLink) {
    parts.push(`🗺 Xarita: ${mapsLink}`);
  }

  parts.push(`💳 To'lov: ${paymentLabel}`);

  if (note?.trim()) {
    parts.push('', '💬 Izoh:', note.trim());
  }

  parts.push(
    '',
    '📦 Mahsulotlar:',
    divider,
    '',
    itemBlocks,
    '',
    divider,
    '',
    `💰 Jami: ${formatPriceUz(total)} so'm`,
  );

  return parts.join('\n');
}

if (!fs.existsSync(LEGACY_IMAGES_DIR)) {
  fs.mkdirSync(LEGACY_IMAGES_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    cb(ok ? null : new Error('Faqat rasm'), ok);
  },
});

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
}));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/images/:filename', asyncHandler(async (req, res) => {
  const filePath = path.join(LEGACY_IMAGES_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  const products = await readProducts();
  const match = findVariantByImage(products, req.params.filename);
  const svg = generatePlaceholderSvg(
    match
      ? { name: match.product.name, scent: match.variant.scent, size: match.variant.size }
      : { name: req.params.filename.replace(/\.[^.]+$/, '').replace(/-/g, ' ') }
  );

  res.type('image/svg+xml').send(svg);
}));

app.get('/api/products', asyncHandler(async (_req, res) => {
  const products = await readProducts();
  res.json(filterProductsForCustomers(products));
}));

app.get('/api/catalog', asyncHandler(async (_req, res) => {
  res.json(await readCatalog());
}));

app.get('/api/admin/catalog', authMiddleware, asyncHandler(async (_req, res) => {
  res.json(await readCatalog());
}));

app.put('/api/admin/catalog', authMiddleware, asyncHandler(async (req, res) => {
  const { brands, categories } = req.body;
  if (!Array.isArray(brands) || !Array.isArray(categories)) {
    return res.status(400).json({ error: 'Noto\'g\'ri ma\'lumot' });
  }
  await writeCatalog({ brands, categories });
  res.json({ success: true });
}));

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Admin parol sozlanmagan' });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Parol noto\'g\'ri' });
  }

  res.json({ token: createToken() });
});

app.get('/api/admin/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  res.json({ ok: verifyToken(token) });
});

app.get('/api/admin/products', authMiddleware, asyncHandler(async (_req, res) => {
  res.json(await readProducts());
}));

app.put('/api/admin/products', authMiddleware, asyncHandler(async (req, res) => {
  const products = req.body;
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Noto\'g\'ri ma\'lumot' });
  }
  await writeProducts(products);
  res.json({ success: true });
}));

app.post('/api/admin/upload', authMiddleware, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Rasm tanlanmadi' });
  }

  const image = await cloudinaryStorage.uploadBuffer(req.file.buffer);
  res.json({ image });
}));

app.post('/api/admin/upload-url', authMiddleware, asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Noto\'g\'ri link' });
  }

  const image = await cloudinaryStorage.uploadFromUrl(url);
  res.json({ image });
}));

app.post('/api/order', asyncHandler(async (req, res) => {
  const { name, phone, location, note, paymentType, items, total } = req.body;

  const paymentLabels = {
    naqd: 'Naqd',
    terminal: 'Terminal',
    transfer: "Kartaga o'tkazma",
  };

  if (!name || !phone || !location || !paymentType || !items?.length) {
    return res.status(400).json({ error: 'Ma\'lumotlar to\'liq emas' });
  }

  if (!paymentLabels[paymentType]) {
    return res.status(400).json({ error: 'To\'lov turi noto\'g\'ri' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ error: 'Telegram sozlanmagan' });
  }

  const text = formatTelegramOrder({
    name,
    phone,
    location,
    paymentType,
    paymentLabel: paymentLabels[paymentType],
    note,
    items,
    total,
  });

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );

  const data = await response.json();
  if (!data.ok) {
    return res.status(500).json({ error: 'Telegramga yuborilmadi' });
  }

  try {
    await saveOrder({ name, phone, location, note, paymentType, items, total });
  } catch (err) {
    console.error('Buyurtma saqlanmadi:', err.message || err);
  }

  res.json({ success: true });
}));

app.get('/api/admin/orders/customers', authMiddleware, asyncHandler(async (req, res) => {
  const search = String(req.query.search || '');
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  res.json(await listCustomers({ search, limit }));
}));

app.get('/api/admin/orders/history', authMiddleware, asyncHandler(async (req, res) => {
  const phone = String(req.query.phone || '');
  if (!phone.trim()) {
    return res.status(400).json({ error: 'Telefon raqami kerak' });
  }
  const history = await getCustomerHistory(phone);
  if (!history) {
    return res.status(404).json({ error: 'Buyurtmalar topilmadi' });
  }
  res.json(history);
}));

app.use((err, _req, res, _next) => {
  if (err.code === '42P01') {
    console.error('PostgreSQL: jadvallar topilmadi. DATABASE_URL va db/schema.sql ni tekshiring.');
  } else {
    console.error(err);
  }
  res.status(500).json({ error: err.message || 'Server xatosi' });
});

async function checkServices() {
  if (!process.env.DATABASE_URL) {
    console.error('\n[!] DATABASE_URL sozlanmagan.');
    console.error('    Railway: PostgreSQL servisini backend bilan ulang — DATABASE_URL avtomatik qo\'shiladi.\n');
    return;
  }

  try {
    await migrate();
    await checkConnection();
    await readCatalog();
    await readProducts();
    console.log('PostgreSQL: ulandi');
  } catch (err) {
    console.error('\n[!] PostgreSQL xatosi:', err.message || err);
  }

  if (cloudinaryStorage.isConfigured()) {
    cloudinaryStorage.configure();
    console.log('Cloudinary: ulandi');
  } else {
    console.error('\n[!] Cloudinary sozlanmagan — rasm yuklash ishlamaydi.');
    console.error('    Cloudinary Dashboard → API Keys → .env ga qo\'shing\n');
  }
}

app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}`);
  console.log(`CORS: ${allowedOrigins.join(', ')}`);
  checkServices();
});

module.exports = app;
