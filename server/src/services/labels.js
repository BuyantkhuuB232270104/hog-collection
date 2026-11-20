const REQUEST_STATUS = { SUBMITTED: 'Илгээсэн', NEED_INFO: 'Нэмэлт мэдээлэл шаардсан', APPROVED: 'Батлагдсан', ASSIGNED: 'Ажилд оноогдсон',
  DONE: 'Гүйцэтгэгдсэн', NOT_DONE: 'Гүйцэтгэгдээгүй', REJECTED: 'Татгалзсан', CANCELLED: 'Цуцлагдсан' };
const JOB_STATUS = { PLANNED: 'Төлөвлөсөн', POSTPONED: 'Хойшлуулсан', STARTED: 'Эхэлсэн', DONE: 'Дууссан', NOT_DONE: 'Гүйцэтгээгүй', CANCELLED: 'Цуцлагдсан' };
const NOT_DONE_REASONS = ['Хаалга, хашаа хаалттай', 'Зам саадтай', 'Хог гараагүй', 'Бусад'];
module.exports = { REQUEST_STATUS, JOB_STATUS, NOT_DONE_REASONS };
