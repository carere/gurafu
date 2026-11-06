import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => Response.json({ status: "ok" }),
    },
  },
});
