const { bad } = require('../errors');
/** Zod схемээр req.body / req.query шалгах; алдааг талбар бүрээр буцаана */
const validate = (schema, where = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[where]);
  if (!r.success) {
    const fields = Object.fromEntries(r.error.issues.map(i => [i.path.join('.') || '_', i.message]));
    return next(bad('VALIDATION', 'Оруулсан мэдээллээ шалгана уу.', fields));
  }
  req.valid = r.data; next();
};
module.exports = validate;
