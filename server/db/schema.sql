-- Дахин ажиллуулахад хуучин хүснэгтүүдийг устгана
DROP TABLE IF EXISTS audit_log, complaints, notifications, status_history, jobs, attachments, requests,
  schedules, waste_types, addresses, service_zones, user_roles, users, roles, organizations CASCADE;
DROP SEQUENCE IF EXISTS request_no_seq;
DROP FUNCTION IF EXISTS forbid_history_change() CASCADE;
-- Хог цуглуулах захиалга, хуваарийн веб систем — өгөгдлийн сангийн схем (PostgreSQL 16)
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE organizations (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       varchar(150) NOT NULL,
  type       varchar(20)  NOT NULL CHECK (type IN ('collector','business','government')),
  active     boolean      NOT NULL DEFAULT true
);
CREATE TABLE roles (
  id   smallint PRIMARY KEY,
  code varchar(20) NOT NULL UNIQUE           -- citizen, business, coordinator, driver, admin, manager
);
CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name     varchar(120) NOT NULL,
  phone         varchar(20)  UNIQUE,
  email         varchar(150) UNIQUE,
  password_hash varchar(255) NOT NULL,       -- Argon2id хэш (NFR-02)
  consent_at    timestamptz  NOT NULL,       -- ХМХТХ 8.1 зөвшөөрөл (BR-01)
  status        varchar(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','disabled')),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  password_changed_at timestamptz,           -- нууц үг солигдсон цагаас өмнөх нэвтрэлтийг хүчингүй болгоно
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE TABLE user_roles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         bigint   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         smallint NOT NULL REFERENCES roles(id),
  organization_id bigint   REFERENCES organizations(id),
  UNIQUE (user_id, role_id, organization_id)
);
CREATE TABLE service_zones (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  name            varchar(100) NOT NULL,
  soum            varchar(50)  NOT NULL,
  bag             varchar(50)
);
CREATE TABLE addresses (                     -- хаягийн лавлах: бүс тодорхойлох (1.4.1)
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zone_id  bigint NOT NULL REFERENCES service_zones(id),
  soum     varchar(50)  NOT NULL,
  bag      varchar(50)  NOT NULL,
  street   varchar(150) NOT NULL,
  UNIQUE (soum, bag, street)
);
CREATE TABLE waste_types (
  id     smallint PRIMARY KEY,
  name   varchar(80) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE schedules (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zone_id    bigint   NOT NULL REFERENCES service_zones(id),
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  time_from  time     NOT NULL,
  time_to    time     NOT NULL CHECK (time_to > time_from),
  valid_from date     NOT NULL,
  valid_to   date,
  version    int      NOT NULL,
  note       text,
  published_by bigint NOT NULL REFERENCES users(id)
);
CREATE SEQUENCE request_no_seq;
CREATE TABLE requests (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_no       varchar(20) NOT NULL UNIQUE
                   DEFAULT 'ХЦ-' || to_char(now(),'YYYY') || '-' || lpad(nextval('request_no_seq')::text, 6, '0'),
  requester_id     bigint   NOT NULL REFERENCES users(id),
  zone_id          bigint   NOT NULL REFERENCES service_zones(id),
  address_id       bigint   NOT NULL REFERENCES addresses(id),
  address_detail   text,
  waste_type_id    smallint NOT NULL REFERENCES waste_types(id),
  preferred_window tstzrange,
  description      text,
  contact_name     varchar(120),           -- утсаар/биечлэн ирсэн хүсэлтийн холбоо барих хүн (FR-12)
  contact_phone    varchar(20),
  channel          varchar(10) NOT NULL DEFAULT 'web' CHECK (channel IN ('web','phone','walkin')),
  status           varchar(20) NOT NULL DEFAULT 'SUBMITTED'
                   CHECK (status IN ('SUBMITTED','NEED_INFO','APPROVED','ASSIGNED','DONE','NOT_DONE','REJECTED','CANCELLED')),
  idempotency_key  uuid UNIQUE,              -- давхар илгээлтээс хамгаалах (BR-09)
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE attachments (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id bigint NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  file_path  varchar(255) NOT NULL,
  size_bytes int NOT NULL CHECK (size_bytes <= 5242880)   -- ≤ 5 МБ (FR-30)
);
CREATE TABLE jobs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id     bigint NOT NULL UNIQUE REFERENCES requests(id),
  assignee_id    bigint NOT NULL REFERENCES users(id),
  planned_window tstzrange NOT NULL,
  started_at     timestamptz,
  finished_at    timestamptz,
  status         varchar(20) NOT NULL DEFAULT 'PLANNED'
                 CHECK (status IN ('PLANNED','POSTPONED','STARTED','DONE','NOT_DONE','CANCELLED')),
  reason         text,
  CHECK (status NOT IN ('POSTPONED','NOT_DONE','CANCELLED') OR reason IS NOT NULL),   -- BR-04
  -- Нэг гүйцэтгэгчид давхцах интервалтай идэвхтэй ажил оноохгүй (BR-05, FR-17)
  CONSTRAINT jobs_no_overlap EXCLUDE USING gist (assignee_id WITH =, planned_window WITH &&)
    WHERE (status IN ('PLANNED','STARTED'))
);
CREATE TABLE status_history (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id bigint NOT NULL REFERENCES requests(id),
  job_id     bigint REFERENCES jobs(id),
  old_status varchar(20),
  new_status varchar(20) NOT NULL,
  reason     text,
  changed_by bigint NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id),
  request_id bigint REFERENCES requests(id),
  message    text NOT NULL,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE complaints (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id     bigint NOT NULL REFERENCES jobs(id),
  user_id    bigint NOT NULL REFERENCES users(id),
  body       text NOT NULL,
  status     varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_requests_status_zone ON requests (status, zone_id, created_at);
CREATE INDEX idx_jobs_assignee ON jobs (assignee_id, status);
CREATE INDEX idx_history_request ON status_history (request_id, changed_at);
-- Түүхийг засах, устгахыг хориглох (BR-08)
CREATE FUNCTION forbid_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'status_history засах/устгах хориотой'; END $$;
CREATE TRIGGER trg_history_readonly BEFORE UPDATE OR DELETE ON status_history
  FOR EACH ROW EXECUTE FUNCTION forbid_history_change();

-- Аюулгүй байдлын аудит бүртгэл: нэвтрэлт, нууц үг, админы үйлдэл (зөвхөн нэмнэ)
CREATE TABLE audit_log (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  action    varchar(40) NOT NULL,
  entity    varchar(40),
  entity_id bigint,
  detail    text,
  ip        varchar(64),
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_at ON audit_log (at DESC);
