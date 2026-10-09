import { trimQueue, acknowledge } from './trackingData';
let active = null;
let queue = [];
const matches = (scope) => active?.sessionId === scope?.sessionId && Boolean(active?.ownerKey) && active?.ownerKey === scope?.ownerKey;
export const trackingStore = {
  read: async () => active,
  set: async (state) => { if (!matches(state)) queue = []; active = state; },
  clear: async (scope) => { if (!scope?.ownerKey || matches(scope)) { active = null; queue = []; } },
  append: async (scope, points) => { if (matches(scope)) queue = trimQueue([...queue, ...points]); },
  peek: async (scope) => matches(scope) ? trimQueue(queue) : [],
  ack: async (scope, receipt) => { if (matches(scope)) queue = acknowledge(trimQueue(queue), receipt); },
};
