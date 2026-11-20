#!/bin/sh
# TC-15: нөөцөөс шинэ өгөгдлийн санд сэргээж, хүснэгт бүрийн мөрийн тоо ба FK холбоосыг эхтэй тулгана.
# Хэрэглээ: SRC_URL=postgres://.../hog DST_URL=postgres://.../hog_restore ./restore-check.sh
set -eu
TMP=$(mktemp); pg_dump --format=custom --no-owner "$SRC_URL" > "$TMP"
pg_restore --clean --if-exists --no-owner -d "$DST_URL" "$TMP" 2>/dev/null || true
Q="SELECT string_agg(t || '=' || n, ' ' ORDER BY t) FROM (
  SELECT 'users' t, count(*) n FROM users UNION ALL SELECT 'requests', count(*) FROM requests UNION ALL SELECT 'jobs', count(*) FROM jobs
  UNION ALL SELECT 'status_history', count(*) FROM status_history UNION ALL SELECT 'schedules', count(*) FROM schedules
  UNION ALL SELECT 'jobs_fk_ok', count(*) FROM jobs j JOIN requests r ON r.id = j.request_id JOIN users u ON u.id = j.assignee_id) x"
A=$(psql -At "$SRC_URL" -c "$Q"); B=$(psql -At "$DST_URL" -c "$Q"); rm -f "$TMP"
echo "Эх:      $A"; echo "Сэргээсэн: $B"
[ "$A" = "$B" ] && echo "TC-15: ТЭНЦСЭН" || { echo "TC-15: ТЭНЦЭЭГҮЙ"; exit 1; }
