// Runs once when the server starts: registers the cron schedules (SPEC §9).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./runtime/scheduler");
    await startScheduler();
  }
}
