import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDemandProfile } from './scm-model.ts';

test('null 지표와 reason code를 보존한다', () => {
  const row = normalizeDemandProfile({ item_id: 'ITEM001', demand_type: null, adi: null, reason_code: 'NO_POSITIVE_DEMAND' });
  assert.equal(row.adi, null);
  assert.equal(row.demandType, null);
  assert.equal(row.reasonCode, 'NO_POSITIVE_DEMAND');
});

test('영문 demand type 코드만 허용한다', () => {
  assert.equal(normalizeDemandProfile({ demand_type: 'INTERMITTENT' }).demandType, 'INTERMITTENT');
  assert.equal(normalizeDemandProfile({ demand_type: '간헐형' }).demandType, null);
});
