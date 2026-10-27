// Every number the cut shows, in one place. `measured: false` means they come from the
// mock-mode run on screen (run one $0.080, run two $0.045, −45 % vs baseline in its run
// summary) and every card that shows them carries a "mock run" tag. On the final day, fill
// them from the real-model run, set `measured: true`, and record where each was measured in
// docs/video/RELEASE.md.
export const NUMBERS = {
  measured: false,
  costBefore: "$0.080",
  costAfter: "$0.045",
  /** Cost vs running the top model on every step, as the run summary's "vs baseline". */
  savingsPct: 45,
  checksPassed: 19,
  checksTotal: 19,
};
