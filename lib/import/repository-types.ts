import type { ImportMode, ImportType } from './types';

export type UploadBatchInput = { fileName: string; importType: ImportType; importMode: ImportMode; totalRows: number };
export type ImportHistoryRow = {
  batchId: string;
  fileName: string;
  importType: ImportType;
  importMode: ImportMode;
  totalRows: number;
  successRows: number;
  warningRows: number;
  errorRows: number;
  status: string;
  uploader: string;
  uploadedAt: string;
};
