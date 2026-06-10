import {
  profileTable,
  type ImportedDataType,
  type TableAnalysisResult,
  type TableProfile,
} from "./tableAnalysis";

export interface UploadedTableBoardData {
  fileId?: string;
  fileName: string;
  fileSize?: number;
  dataType: ImportedDataType;
  headers: string[];
  rows: any[];
  rowCount?: number;
  columnCount?: number;
  status?: "parsed" | "failed";
  serverAnalysis?: TableAnalysisResult;
  sheets?: {
    name: string;
    headers: string[];
    rows: any[];
    dailySeries?: {
      date: string;
      value?: number;
      sku: string;
      name: string;
      sales?: number;
      uv: number;
      buyers: number;
      cr: number;
    }[];
    profile?: TableProfile;
  }[];
  activeSheetIndex?: number;
  importedAt: string;
}

export interface TableUploadRecord {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedAt: string;
  rowCount: number;
  columnCount: number;
  fields: TableAnalysisResult["fields"];
  metrics: TableAnalysisResult["metrics"];
  analysis: Pick<TableAnalysisResult, "topDimensions" | "dateTrend" | "diagnostics">;
  previewRows: Record<string, unknown>[];
  status: "parsed" | "failed";
  errorMessage?: string;
}

export type TableUploadRecordSummary = Omit<TableUploadRecord, "previewRows">;

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `请求失败（HTTP ${response.status}）`);
  }
  return payload as T;
}

export function recordToBoardData(record: TableUploadRecord): UploadedTableBoardData {
  const headers = record.fields.map((field) => field.name);
  const dataType = profileTable(headers, record.previewRows).businessDomain;
  return {
    fileId: record.id,
    fileName: record.fileName,
    fileSize: record.fileSize,
    dataType,
    headers,
    rows: record.previewRows,
    rowCount: record.rowCount,
    columnCount: record.columnCount,
    status: record.status,
    serverAnalysis: {
      fields: record.fields,
      metrics: record.metrics,
      topDimensions: record.analysis.topDimensions,
      dateTrend: record.analysis.dateTrend,
      diagnostics: record.analysis.diagnostics,
    },
    importedAt: new Date(record.uploadedAt).toLocaleString("zh-CN", { hour12: false }),
  };
}

export async function uploadTableFile(file: File): Promise<TableUploadRecord> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/table/upload", { method: "POST", body });
  const payload = await parseApiResponse<{ record: TableUploadRecord }>(response);
  return payload.record;
}

export async function fetchTableRecords(): Promise<TableUploadRecordSummary[]> {
  const response = await fetch("/api/table/records");
  const payload = await parseApiResponse<{ records: TableUploadRecordSummary[] }>(response);
  return payload.records;
}

export async function fetchTableRecord(id: string): Promise<TableUploadRecord> {
  const response = await fetch(`/api/table/records/${encodeURIComponent(id)}`);
  const payload = await parseApiResponse<{ record: TableUploadRecord }>(response);
  return payload.record;
}

export async function deleteTableRecord(id: string): Promise<void> {
  const response = await fetch(`/api/table/records/${encodeURIComponent(id)}`, { method: "DELETE" });
  await parseApiResponse<{ success: true }>(response);
}
