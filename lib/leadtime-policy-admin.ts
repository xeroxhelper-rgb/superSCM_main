import { revalidatePath } from 'next/cache';
import { requireAdmin } from './auth';
import { createSupabaseServerClient } from './supabase/server';

export async function updateLeadtimePolicy(input: { supplierId: string; leadTime: number; effectiveFrom: string; reason: string }) {
  const actor = await requireAdmin();
  if (!input.supplierId || !Number.isInteger(input.leadTime) || input.leadTime < 0 || !input.effectiveFrom || !input.reason.trim()) throw new Error('Lead Time과 변경 사유를 확인해주세요.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').rpc('admin_set_leadtime', {
    p_supplier_id: input.supplierId,
    p_next_lead_time: input.leadTime,
    p_effective_from: input.effectiveFrom,
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/scm-policies/leadtime');
  revalidatePath('/analysis/leadtime');
  revalidatePath('/analysis/stockout');
  return { actorId: actor.userId };
}
