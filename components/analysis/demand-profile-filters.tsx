'use client';

import type { DemandProfile, DemandType } from '@/lib/scm-model';

export type DemandProfileFilter = {
  demandType: DemandType | 'ALL';
  calculation: 'ALL' | 'AVAILABLE' | 'UNAVAILABLE';
  search: string;
};

export default function DemandProfileFilters({ value, onChange }: { value: DemandProfileFilter; onChange: (next: DemandProfileFilter) => void }) {
  return <div className="analysis-filters" aria-label="수요 프로파일 필터">
    <label>Demand Type<select value={value.demandType} onChange={(event) => onChange({ ...value, demandType: event.target.value as DemandProfileFilter['demandType'] })}>
      <option value="ALL">전체</option><option value="SMOOTH">SMOOTH</option><option value="INTERMITTENT">INTERMITTENT</option><option value="ERRATIC">ERRATIC</option><option value="LUMPY">LUMPY</option>
    </select></label>
    <label>계산 가능<select value={value.calculation} onChange={(event) => onChange({ ...value, calculation: event.target.value as DemandProfileFilter['calculation'] })}>
      <option value="ALL">전체</option><option value="AVAILABLE">계산 가능</option><option value="UNAVAILABLE">계산 불가</option>
    </select></label>
    <label>SKU 검색<input value={value.search} onChange={(event) => onChange({ ...value, search: event.target.value })} placeholder="SKU를 입력하세요" /></label>
  </div>;
}

export function filterDemandProfiles(rows: DemandProfile[], filter: DemandProfileFilter) {
  const search = filter.search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesType = filter.demandType === 'ALL' || row.demandType === filter.demandType;
    const matchesCalculation = filter.calculation === 'ALL'
      || (filter.calculation === 'AVAILABLE' && row.demandType !== null)
      || (filter.calculation === 'UNAVAILABLE' && row.demandType === null);
    const matchesSearch = search.length === 0 || row.itemId.toLowerCase().includes(search) || row.itemName.toLowerCase().includes(search);
    return matchesType && matchesCalculation && matchesSearch;
  });
}
