const app = require('./app');
const config = require('./config');
const migrate = require('./db/migrate');

migrate()
  .then(ran => { if (ran.length) console.log(`Өгөгдлийн сан шинэчлэгдлээ: ${ran.join(', ')}`); })
  .catch(e => { console.error('Өгөгдлийн сангийн шинэчлэл амжилтгүй:', e.message); })
  .finally(() => app.listen(config.port, () => console.log(`Хог цуглуулалтын систем: http://localhost:${config.port}`)));
