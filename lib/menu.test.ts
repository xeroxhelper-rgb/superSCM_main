import test from 'node:test';
import assert from 'node:assert/strict';
import * as menuModule from './menu.ts';

test('USER 메뉴는 원래 업무 흐름과 분석 그룹 순서를 유지한다', () => {
  const items = menuModule.menuByRole.user;

  assert.deepEqual(
    items.map((item) => [item.section, item.label]),
    [
      ['WORKFLOW', '전체 현황'],
      ['WORKFLOW', '수요 확정'],
      ['WORKFLOW', '재고·공급'],
      ['WORKFLOW', '마스터 검증'],
      ['WORKFLOW', '발주량 계산'],
      ['WORKFLOW', '보고자료'],
      ['ANALYSIS', '분석 화면'],
    ],
  );
});

test('workflow query는 허용된 단계만 초기 단계로 변환한다', () => {
  const workflowStepFromParam = (menuModule as typeof menuModule & {
    workflowStepFromParam?: (value: string | string[] | undefined) => string;
  }).workflowStepFromParam;

  assert.equal(typeof workflowStepFromParam, 'function');
  assert.equal(workflowStepFromParam?.('demand'), 'demand');
  assert.equal(workflowStepFromParam?.('report'), 'report');
  assert.equal(workflowStepFromParam?.('unknown'), 'dashboard');
  assert.equal(workflowStepFromParam?.(['supply']), 'dashboard');
  assert.equal(workflowStepFromParam?.(undefined), 'dashboard');
});
