const cloudinary = require('cloudinary').v2;

const FOLDER = process.env.CLOUDINARY_FOLDER || 'lider-parfum/products';

function isConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET
  );
}

function configure() {
  if (!isConfigured()) return false;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return true;
}

function ensureConfigured() {
  if (!configure()) {
    throw new Error('Cloudinary sozlanmagan — CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET kerak');
  }
}

function uploadBuffer(buffer) {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: 'image' },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

async function uploadFromUrl(url) {
  ensureConfigured();

  const result = await cloudinary.uploader.upload(url, {
    folder: FOLDER,
    resource_type: 'image',
  });

  return result.secure_url;
}

module.exports = {
  isConfigured,
  configure,
  uploadBuffer,
  uploadFromUrl,
};
