import { PrismaClient } from "@prisma/client";

const SLOW_QUERY_THRESHOLD_MS = 300;
const shouldLogSlowQueries = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

const prisma = new PrismaClient({
  log: shouldLogSlowQueries ? [{ emit: "event", level: "query" }] : [],
});

prisma.$on("query", (event) => {
  if (!shouldLogSlowQueries || event.duration < SLOW_QUERY_THRESHOLD_MS) {
    return;
  }

  console.warn("[prisma:slow-query]", {
    durationMs: event.duration,
    query: event.query,
  });
});

export default prisma;
