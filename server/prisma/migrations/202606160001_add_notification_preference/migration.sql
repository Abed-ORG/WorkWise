CREATE TYPE "NotificationPreference" AS ENUM ('ALL', 'MENTIONS_ONLY', 'NONE');

ALTER TABLE "users"
ADD COLUMN "notificationPreference" "NotificationPreference" NOT NULL DEFAULT 'ALL';
