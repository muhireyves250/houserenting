// Lives for one page load: opening a link, a new tab or a hard refresh resets it; in-app navigation doesn't.
let shownThisLoad = false;

/** True the first time it's called in a page load (the welcome should show); false afterwards. */
export function claimWelcome(): boolean {
  if (shownThisLoad) return false;
  shownThisLoad = true;
  return true;
}

/** The welcome page itself was opened: don't send the visitor through it again in this load. */
export function markWelcomeShown(): void {
  shownThisLoad = true;
}
