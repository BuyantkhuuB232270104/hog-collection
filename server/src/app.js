const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');
const { AppError } = require('./errors');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'blob:'] } } }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API зам олдсонгүй.' } }));

// Front end-ийн build-ийг (client/dist) нэг серверээс түгээнэ
const dist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Алдааг нэг хэлбэрээр буцаана: { error: { code, message, details } }
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: 'Зураг 5 МБ-аас ихгүй байна.' } });
  if (err.name === 'ZodError') return res.status(400).json({ error: { code: 'VALIDATION', message: 'Оруулсан утга буруу.' } });
  if (err.code === '23514') return res.status(400).json({ error: { code: 'CONSTRAINT', message: 'Өгөгдлийн сангийн шалгалтад тэнцсэнгүй (шалтгаан, утга шалгана уу).' } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Серверийн алдаа гарлаа.' } });
});
module.exports = app;
