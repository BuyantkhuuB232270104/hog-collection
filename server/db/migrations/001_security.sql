-- Байгаа өгөгдлийн санг устгахгүйгээр шинэ талбар, хүснэгт нэмнэ (дахин ажиллуулахад аюулгүй)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
CREATE TABLE IF NOT EXISTS audit_log (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  action    varchar(40) NOT NULL,
  entity    varchar(40),
  entity_id bigint,
  detail    text,
  ip        varchar(64),
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at DESC);
