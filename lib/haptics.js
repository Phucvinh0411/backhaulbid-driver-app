// Haptics are best-effort. expo-haptics is a native module, so builds made before it was added
// do not have it: the require fails there and every call becomes a no-op instead of a crash.
let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch {
  Haptics = null;
}

const fire = (work) => {
  if (!Haptics) return;
  try {
    Promise.resolve(work()).catch(() => {});
  } catch {
    // Unsupported device: feedback is a bonus, never a failure path.
  }
};

/** A confirmed action: bid accepted, milestone reached, proof sent. */
export const hapticSuccess = () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
/** Something needs attention but nothing was lost: a blocked bid, a missing handover. */
export const hapticWarning = () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
/** The action failed and the user must act: a rejected bid, a failed check-in. */
export const hapticError = () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
/** A tap on a primary control. Use sparingly; most taps stay silent. */
export const hapticTap = () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
