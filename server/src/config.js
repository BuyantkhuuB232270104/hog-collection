require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const config = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  port: Number(process.env.PORT || 3000),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  isProd: process.env.NODE_ENV === 'production',
};
if (!config.databaseUrl) throw new Error('DATABASE_URL тохируулаагүй байна (.env)');
if (!config.jwtSecret) throw new Error('JWT_SECRET тохируулаагүй байна (.env)');
module.exports = config;
