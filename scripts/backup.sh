#!/bin/sh
# Өдөр бүрийн нөөцлөлт (NFR-04). cron жишээ: 0 2 * * * /opt/hog/scripts/backup.sh
# Хэрэглээ: DATABASE_URL=postgres://... BACKUP_DIR=/var/backups/hog ./backup.sh
set -eu
DIR="${BACKUP_DIR:-./backups}"; mkdir -p "$DIR"
FILE="$DIR/hog_$(date +%Y%m%d_%H%M).dump"
pg_dump --format=custom --no-owner "$DATABASE_URL" > "$FILE"
find "$DIR" -name 'hog_*.dump' -mtime +30 -delete   # 30 хоногоос хуучныг устгана
echo "Нөөц: $FILE"
