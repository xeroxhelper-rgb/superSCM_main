'use server';

import { redirect } from 'next/navigation';
import { updateLeadtimePolicy } from '@/lib/leadtime-policy-admin';

export async function updateLeadtimePolicyAction(formData: FormData) {
  const supplierId = String(formData.get('supplier_id') ?? '');
  const leadTime = Number(formData.get('lead_time'));
  const effectiveFrom = String(formData.get('effective_from') ?? '');
  const reason = String(formData.get('reason') ?? '');
  try {
    await updateLeadtimePolicy({ supplierId, leadTime, effectiveFrom, reason });
  } catch {
    redirect('/admin/scm-policies/leadtime?error=update');
  }
  redirect('/admin/scm-policies/leadtime?success=updated');
}
