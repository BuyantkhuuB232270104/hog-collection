const { z } = require('zod');
const phone = z.string().trim().regex(/^[0-9]{8}$/, 'Утасны дугаар 8 оронтой байна');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Огноо ОООО-СС-ӨӨ хэлбэртэй');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Цаг ЦЦ:ММ хэлбэртэй');
const id = z.coerce.number().int().positive();
// Нууц үг: 8–128 тэмдэгт, үсэг ба тоо заавал
const password = z.string().min(8, 'Нууц үг дор хаяж 8 тэмдэгт').max(128)
  .regex(/[A-Za-z\u0400-\u04FF]/, 'Нууц үг үсэг агуулсан байх').regex(/[0-9]/, 'Нууц үг тоо агуулсан байх');

module.exports = {
  register: z.object({
    fullName: z.string().trim().min(2, 'Нэрээ оруулна уу').max(120),
    phone: phone.optional().or(z.literal('')),
    email: z.string().trim().email('Имэйл буруу').optional().or(z.literal('')),
    password,
    consent: z.literal(true, { errorMap: () => ({ message: 'Зөвшөөрөл шаардлагатай' }) }),
    accountType: z.enum(['citizen', 'business']).default('citizen'),
    organizationName: z.string().trim().max(150).optional(),
  }).refine(d => d.phone || d.email, { message: 'Утас эсвэл имэйлийн аль нэгийг оруулна уу', path: ['phone'] })
    .refine(d => d.accountType !== 'business' || (d.organizationName && d.organizationName.length >= 2), { message: 'Байгууллагын нэрээ оруулна уу', path: ['organizationName'] }),
  login: z.object({ login: z.string().trim().min(3), password: z.string().min(1) }),
  schedule: z.object({
    zoneId: id, validFrom: date, note: z.string().max(500).optional(),
    slots: z.array(z.object({ weekday: z.number().int().min(1).max(7), timeFrom: time, timeTo: time })).min(1, 'Дор хаяж нэг өдөр оруулна уу'),
  }),
  request: z.object({
    addressId: id, addressDetail: z.string().max(200).optional(), wasteTypeId: id,
    preferredDate: date.optional(), preferredFrom: time.optional(), preferredTo: time.optional(),
    description: z.string().max(1000).optional(),
    channel: z.enum(['web', 'phone', 'walkin']).optional(),
    contactName: z.string().max(120).optional(), contactPhone: phone.optional(),
  }).refine(d => !d.channel || d.channel === 'web' || (d.contactName && d.contactPhone), { message: 'Холбоо барих хүний нэр, утсыг оруулна уу', path: ['contactName'] }),
  decision: z.object({ decision: z.enum(['approve', 'reject', 'need_info']), reason: z.string().trim().max(500).optional() }),
  supply: z.object({ description: z.string().trim().min(2).max(1000) }),
  assign: z.object({ requestId: id, date, timeFrom: time, timeTo: time, assigneeId: id }),
  jobChange: z.object({ action: z.enum(['reassign', 'postpone', 'cancel']), reason: z.string().trim().max(500).optional(),
    date: date.optional(), timeFrom: time.optional(), timeTo: time.optional(), assigneeId: id.optional() })
    .refine(d => d.action !== 'reassign' || (d.date && d.timeFrom && d.timeTo && d.assigneeId), { message: 'Огноо, интервал, гүйцэтгэгчийг оруулна уу', path: ['date'] }),
  jobRecord: z.object({ result: z.enum(['start', 'done', 'not_done']), reason: z.string().trim().max(300).optional() }),
  complaint: z.object({ requestId: id, body: z.string().trim().min(5, 'Гомдлоо дэлгэрэнгүй бичнэ үү').max(1000) }),
  complaintStatus: z.object({ status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']), note: z.string().max(300).optional() }),
  reportQuery: z.object({ from: date, to: date, zoneId: id.optional(), assigneeId: id.optional(), format: z.enum(['json', 'csv']).default('json') }),
  staff: z.object({ fullName: z.string().trim().min(2), phone, email: z.string().email().optional().or(z.literal('')),
    password, role: z.enum(['coordinator', 'driver', 'manager', 'admin']), organizationId: id.optional() }),
  role: z.object({ role: z.enum(['citizen', 'business', 'coordinator', 'driver', 'manager', 'admin']), organizationId: id.optional() }),
  changePassword: z.object({ currentPassword: z.string().min(1, 'Одоогийн нууц үгээ оруулна уу'), newPassword: password })
    .refine(d => d.currentPassword !== d.newPassword, { message: 'Шинэ нууц үг одоогийнхоос өөр байх ёстой', path: ['newPassword'] }),
  profile: z.object({ fullName: z.string().trim().min(2, 'Нэрээ оруулна уу').max(120), email: z.string().trim().email('Имэйл буруу').optional().or(z.literal('')) }),
  resetPassword: z.object({ password }),
  requestSearch: z.object({ status: z.string().max(120).optional(), zoneId: id.optional(), q: z.string().trim().max(80).optional() }),
  date, id,
};
