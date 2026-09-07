import assert from 'node:assert/strict';
import { anniversaryDays, anniversaryTarget, nextAnniversary } from '../app/anniversary-dates.ts';
process.env.TZ = 'America/New_York';
const item = (date, repeats = false) => ({ date, repeats });
for (const hour of [0, 11, 12, 23]) {
 const now = new Date(2026, 8, 7, hour, 59);
 assert.equal(anniversaryDays(item('2026-09-07'), now), 0);
 assert.equal(anniversaryDays(item('2020-09-07', true), now), 0);
 assert.equal(anniversaryDays(item('2026-09-08'), now), 1);
}
assert.equal(anniversaryDays(item('2026-03-09'), new Date(2026, 2, 8, 0)), 1);
assert.equal(anniversaryDays(item('2026-11-02'), new Date(2026, 10, 1, 0)), 1);
assert.equal(anniversaryDays(item('2026-09-06'), new Date(2026, 8, 7, 1)), -1);
assert.equal(anniversaryTarget(item('2020-02-29', true), new Date(2027, 3, 1)).getDate(), 29);
const past = item('2026-09-06'), old = item('2020-01-01'), future = item('2026-09-08');
const now = new Date(2026, 8, 7, 23);
assert.equal(nextAnniversary([old, future, past], now), future);
assert.equal(nextAnniversary([old, past], now), past);
assert.equal(nextAnniversary([item('invalid')], now), undefined);
assert.equal(nextAnniversary([], now), undefined);
console.log('PASS anniversary calendar days, DST, leap recurrence, future/past selection');
