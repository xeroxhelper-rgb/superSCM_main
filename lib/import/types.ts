export type ImportType =
  | 'usage_history'
  | 'inventory'
  | 'item_master'
  | 'supplier_master'
  | 'purchase_order'
  | 'goods_receipt'
  | 'sales_order'
  | 'business_event';

export type ImportMode = 'append' | 'upsert' | 'replace';
export type ValidationStatus = 'PENDING' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type ValidationSeverity = 'WARNING' | 'ERROR';
export type SourceRow = Record<string, string>;

export type ImportField = {
  name: string;
  dbColumn: string;
  required?: boolean;
  kind: 'text' | 'number' | 'date';
  aliases: string[];
  allowNegative?: boolean;
};

export type ImportSchema = {
  importType: ImportType;
  targetTable: string;
  fields: ImportField[];
  requiredFields: string[];
  businessKey: string[];
};

export type ColumnMapping = {
  sourceColumn: string;
  targetColumn: string | null;
  confidence: number;
  confirmed?: boolean;
};

export type ParsedImport = {
  fileName: string;
  headers: string[];
  rows: SourceRow[];
  totalRows: number;
};

export type MappedRow = {
  rowNumber: number;
  source: SourceRow;
  normalized: Record<string, string>;
};

export type ValidationIssue = {
  rowNumber: number;
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  severity: ValidationSeverity;
  originalValue: string;
};

export type ValidationContext = {
  knownItems?: Set<string>;
  knownSuppliers?: Set<string>;
  existingKeys?: Set<string>;
  duplicateSeverity?: ValidationSeverity;
};

export type ValidationSummary = {
  rows: Array<{ rowNumber: number; status: ValidationStatus }>;
  issues: ValidationIssue[];
  successRows: number;
  warningRows: number;
  errorRows: number;
};
