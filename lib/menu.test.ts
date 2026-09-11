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
    ['ANALYSIS', '수요 패턴'],
      ['ANALYSIS', 'OL 예측 정확도'],
      ['ANALYSIS', '재고 소진 위험'],
      ['ANALYSIS', 'SCM Agent'],
    ],
  );
});

test('쿼리스트링이 있는 워크플로우 메뉴도 현재 단계로 활성화한다', () => {
  const isMenuItemActive = (menuModule as typeof menuModule & {
    isMenuItemActive?: (pathname: string, search: string, item: menuModule.MenuItem) => boolean;
  }).isMenuItemActive;
  const demand = menuModule.menuByRole.user.find((item) => item.label === '수요 확정');

  assert.equal(typeof isMenuItemActive, 'function');
  assert.equal(isMenuItemActive?.('/workflow', '?step=demand', demand!), true);
  assert.equal(isMenuItemActive?.('/workflow', '?step=supply', demand!), false);
});

test('Workflow URL의 step 쿼리를 화면 단계로 변환한다', () => {
  const workflowStepFromSearch = (menuModule as typeof menuModule & {
    workflowStepFromSearch?: (search: string) => menuModule.WorkflowStep;
  }).workflowStepFromSearch;

  assert.equal(workflowStepFromSearch?.('?step=demand'), 'demand');
  assert.equal(workflowStepFromSearch?.('?step=report'), 'report');
  assert.equal(workflowStepFromSearch?.('?step=unknown'), 'dashboard');
  assert.equal(workflowStepFromSearch?.(''), 'dashboard');
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

test('ADMIN 메뉴에 사용자 관리가 있고 USER 메뉴에는 없다', () => {
  assert.equal(menuModule.menuByRole.admin.some((item) => item.href === '/admin/users'), true);
  assert.equal(menuModule.menuByRole.user.some((item) => item.href.startsWith('/admin')), false);
});
