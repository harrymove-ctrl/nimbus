// Runs once when the server starts: registers the cron schedules (SPEC §9) and starts the Telegram bot (docs/TELEGRAM.md).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./runtime/scheduler");
    await startScheduler();
    const { startTelegram } = await import("./runtime/telegram");
    startTelegram();
  }
}
