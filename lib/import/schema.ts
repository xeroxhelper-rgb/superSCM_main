import type { ImportField, ImportSchema, ImportType } from './types';

const commonTrackingFields: ImportField[] = [
  { name: 'batch_id', dbColumn: 'batch_id', kind: 'text', aliases: [] },
  { name: 'source_type', dbColumn: 'source_type', kind: 'text', aliases: [] },
  { name: 'loaded_at', dbColumn: 'loaded_at', kind: 'text', aliases: [] },
  { name: 'source_record_id', dbColumn: 'source_record_id', kind: 'text', aliases: [] },
];

const schemas: Record<ImportType, ImportSchema> = {
  usage_history: {
    importType: 'usage_history', targetTable: 'usage_history',
    fields: [
      { name: 'usage_id', dbColumn: 'usage_id', kind: 'text', aliases: ['사용기록ID', 'usage id'] },
      { name: 'item_id', dbColumn: 'item_id', kind: 'text', required: true, aliases: ['품목코드', '품목', 'item code', 'sku'] },
      { name: 'use_date', dbColumn: 'use_date', kind: 'date', required: true, aliases: ['사용일', '출고일', '사용일자', 'use date'] },
      { name: 'qty', dbColumn: 'qty', kind: 'number', required: true, aliases: ['수량', '출고수량', '사용량', 'quantity'] },
      { name: 'warehouse', dbColumn: 'warehouse', kind: 'text', aliases: ['창고', 'warehouse'] },
      { name: 'note', dbColumn: 'note', kind: 'text', aliases: ['비고', '메모', 'note'] },
      ...commonTrackingFields,
    ], businessKey: ['item_id', 'use_date', 'warehouse'],
  },
  inventory: {
    importType: 'inventory', targetTable: 'inventory',
    fields: [
      { name: 'item_id', dbColumn: '품목코드', kind: 'text', required: true, aliases: ['품목코드', 'item_id', 'sku'] },
      { name: 'warehouse', dbColumn: '창고', kind: 'text', aliases: ['창고', 'warehouse'] },
      { name: 'current_stock', dbColumn: '현재고', kind: 'number', required: true, aliases: ['현재고', '재고', 'stock'] },
      { name: 'as_of_date', dbColumn: '기준일자', kind: 'date', aliases: ['기준일자', '기준일', 'as_of_date'] },
      { name: 'safety_stock', dbColumn: '안전재고', kind: 'number', aliases: ['안전재고', 'safety stock'] },
      ...commonTrackingFields,
    ], businessKey: ['품목코드', '창고', '기준일자'],
  },
  item_master: {
    importType: 'item_master', targetTable: 'item_master',
    fields: [
      { name: 'item_id', dbColumn: '품목코드', kind: 'text', required: true, aliases: ['품목코드', 'item_id', 'sku'] },
      { name: 'item_name', dbColumn: '품목명', kind: 'text', required: true, aliases: ['품목명', 'item_name'] },
      { name: 'item_type', dbColumn: '품목구분', kind: 'text', aliases: ['품목구분', 'item_type'] },
      { name: 'unit', dbColumn: '단위', kind: 'text', aliases: ['단위', 'unit'] },
      { name: 'unit_price', dbColumn: '표준단가', kind: 'number', aliases: ['표준단가', '단가', 'unit_price'] },
      { name: 'is_active', dbColumn: '사용여부', kind: 'text', aliases: ['사용여부', 'is_active'] },
      { name: 'supplier_id', dbColumn: 'supplier_id', kind: 'text', aliases: ['공급처코드', 'supplier_id'] },
      ...commonTrackingFields,
    ], businessKey: ['품목코드'],
  },
  supplier_master: {
    importType: 'supplier_master', targetTable: 'supplier_master',
    fields: [
      { name: 'supplier_id', dbColumn: '공급업체코드', kind: 'text', required: true, aliases: ['공급업체코드', '공급처코드', 'supplier_id'] },
      { name: 'supplier_name', dbColumn: '공급업체명', kind: 'text', required: true, aliases: ['공급업체명', '공급처명', 'supplier_name'] },
      { name: 'country', dbColumn: '국가', kind: 'text', aliases: ['국가', 'country'] },
      { name: 'standard_lead_time', dbColumn: '표준리드타임(일)', kind: 'number', aliases: ['표준리드타임(일)', '리드타임', 'lead_time'] },
      { name: 'contact', dbColumn: '담당자', kind: 'text', aliases: ['담당자', 'contact'] },
      { name: 'is_active', dbColumn: '사용여부', kind: 'text', aliases: ['사용여부', 'is_active'] },
      ...commonTrackingFields,
    ], businessKey: ['공급업체코드'],
  },
  purchase_order: {
    importType: 'purchase_order', targetTable: 'purchase_order',
    fields: [
      { name: 'order_id', dbColumn: '발주번호', kind: 'text', required: true, aliases: ['발주번호', 'order_id'] },
      { name: 'order_date', dbColumn: '발주일', kind: 'date', required: true, aliases: ['발주일', '발주일자', 'order_date'] },
      { name: 'supplier_id', dbColumn: '공급업체', kind: 'text', required: true, aliases: ['공급업체', '공급처', 'supplier_id'] },
      { name: 'item_id', dbColumn: '품목코드', kind: 'text', required: true, aliases: ['품목코드', 'item_id', 'sku'] },
      { name: 'quantity', dbColumn: '발주수량', kind: 'number', required: true, aliases: ['발주수량', '수량', 'quantity'] },
      { name: 'unit_price', dbColumn: '단가', kind: 'number', aliases: ['단가', 'unit_price'] },
      { name: 'expected_date', dbColumn: '납기예정일', kind: 'date', aliases: ['납기예정일', '납기일', 'expected_date'] },
      { name: 'buyer', dbColumn: '발주담당', kind: 'text', aliases: ['발주담당', '담당자', 'buyer'] },
      ...commonTrackingFields,
    ], businessKey: ['발주번호', '품목코드'],
  },
  goods_receipt: {
    importType: 'goods_receipt', targetTable: 'goods_receipt',
    fields: [
      { name: 'receipt_id', dbColumn: '입고번호', kind: 'text', required: true, aliases: ['입고번호', 'receipt_id'] },
      { name: 'order_id', dbColumn: '발주번호', kind: 'text', required: true, aliases: ['발주번호', 'order_id'] },
      { name: 'item_id', dbColumn: '품목코드', kind: 'text', required: true, aliases: ['품목코드', 'item_id', 'sku'] },
      { name: 'quantity', dbColumn: '입고수량', kind: 'number', required: true, aliases: ['입고수량', '수량', 'quantity'] },
      { name: 'receipt_date', dbColumn: '입고일', kind: 'date', required: true, aliases: ['입고일', '입고일자', 'receipt_date'] },
      { name: 'warehouse', dbColumn: '입고창고', kind: 'text', aliases: ['입고창고', '창고', 'warehouse'] },
      ...commonTrackingFields,
    ], businessKey: ['입고번호'],
  },
  sales_order: {
    importType: 'sales_order', targetTable: 'sales_order',
    fields: [
      { name: 'order_id', dbColumn: 'order_id', kind: 'text', required: true, aliases: ['주문번호', 'order_id'] },
      { name: 'order_date', dbColumn: 'order_date', kind: 'date', required: true, aliases: ['주문일', 'order_date'] },
      { name: 'customer_id', dbColumn: 'customer_id', kind: 'text', aliases: ['고객코드', 'customer_id'] },
      { name: 'item_id', dbColumn: 'item_id', kind: 'text', required: true, aliases: ['품목코드', 'item_id', 'sku'] },
      { name: 'quantity', dbColumn: 'quantity', kind: 'number', required: true, aliases: ['주문수량', '수량', 'quantity'] },
      { name: 'requested_date', dbColumn: 'requested_date', kind: 'date', aliases: ['요청일', 'requested_date'] },
      { name: 'status', dbColumn: 'status', kind: 'text', aliases: ['상태', 'status'] },
      ...commonTrackingFields,
    ], businessKey: ['order_id', 'item_id'],
  },
  business_event: {
    importType: 'business_event', targetTable: 'business_event',
    fields: [
      { name: 'event_type', dbColumn: 'event_type', kind: 'text', required: true, aliases: ['이벤트유형', 'event_type'] },
      { name: 'event_date', dbColumn: 'event_date', kind: 'date', required: true, aliases: ['이벤트일', 'event_date'] },
      { name: 'item_id', dbColumn: 'item_id', kind: 'text', aliases: ['품목코드', 'item_id', 'sku'] },
      { name: 'quantity', dbColumn: 'quantity', kind: 'number', aliases: ['수량', 'quantity'] },
      { name: 'customer_id', dbColumn: 'customer_id', kind: 'text', aliases: ['고객코드', 'customer_id'] },
      { name: 'note', dbColumn: 'note', kind: 'text', aliases: ['비고', 'note'] },
      ...commonTrackingFields,
    ], businessKey: ['event_type', 'event_date', 'item_id'],
  },
};

export function getImportSchema(importType: ImportType): ImportSchema {
  const schema = schemas[importType];
  return { ...schema, requiredFields: schema.fields.filter((field) => field.required).map((field) => field.name) };
}

export function getSupportedImportTypes(): ImportType[] {
  return Object.keys(schemas) as ImportType[];
}
