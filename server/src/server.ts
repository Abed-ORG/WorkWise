import http from "http";
import app from "./app";
import { dailyDigestScheduler } from "./services/daily-digest-scheduler.service";
import { initializeRealtime } from "./services/realtime.service";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5000;

if (Number.isNaN(PORT)) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const server = http.createServer(app);
initializeRealtime(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  dailyDigestScheduler.start();
});
