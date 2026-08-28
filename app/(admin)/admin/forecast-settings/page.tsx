import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import ForecastSettingsPanel from '@/components/admin/forecast-settings-panel';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ForecastSettingsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('analytics').from('v_forecast_setting_admin').select('*').maybeSingle();
  if (error) return <><PageHeader eyebrow="ADMIN / FORECAST" title="Forecast 설정 검증" description="학습·검증 기간과 정책값을 확인합니다." /><Panel title="조회 실패"><p className="empty-state-ui"><strong>조회에 실패했습니다.</strong><br />{error.message}</p></Panel></>;
  if (!data) return <><PageHeader eyebrow="ADMIN / FORECAST" title="Forecast 설정 검증" description="학습·검증 기간과 정책값을 확인합니다." /><Panel title="설정 없음"><p className="empty-state-ui">관리자 권한으로 설정이 아직 구성되지 않았습니다.</p></Panel></>;
  return <><PageHeader eyebrow="ADMIN / FORECAST" title="Forecast 설정 검증" description="학습·검증 기간과 정책값을 확인합니다." /><ForecastSettingsPanel row={data} /></>;
}
