// An idle connection must not create a thread with no durable rollout.
export async function syncCodexThread(options: {
  hasThread: boolean; newConnection: boolean; createIfMissing: boolean; instructionsChanged: boolean;
  start: () => Promise<void>; resume: () => Promise<void>;
}) {
  if (!options.hasThread) {
    if (options.createIfMissing) await options.start();
    return;
  }
  if (options.newConnection || options.instructionsChanged) await options.resume();
}

// A send must wait for initialization/restoration before inspecting socket state.
export function createConnectionQueue() {
  let tail: Promise<void> = Promise.resolve();
  return (task: () => Promise<void>) => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
}
