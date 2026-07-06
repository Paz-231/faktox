import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

// ═══════════════════════════════════════════════════════════
// Convex Internal Cron — kein externer HTTP Call nötig,
// kein ADMIN_KEY. Backup läuft komplett innerhalb Convex.
//
// 05:00 CET = 03:00 UTC (Sommerzeit)
// 05:00 CET = 04:00 UTC (Winterzeit)
// Wir nehmen 03:00 UTC — Sommerzeit ist korrekt,
// Winterzeit läuft 1h früher (04:00 MEZ) — akzeptabel.
// ═══════════════════════════════════════════════════════════

const crons = cronJobs();

crons.daily(
  "faktox-daily-backup",
  { hourUTC: 3, minuteUTC: 0 },
  api.backupCron.runDailyBackup,
);

export default crons;
