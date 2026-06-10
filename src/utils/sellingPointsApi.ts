export type SellingPointItem = {
  id: string;
  name: string;
  diffScore: unknown;
  diffReason: unknown;
  competitorHighlight: unknown;
  targetAudience: unknown;
  channels: string[];
};

export type SellingPointAsset = {
  basicInfo: {
    brand: unknown;
    productName: unknown;
    spec: unknown;
    coreIngredients: unknown;
    targetAudience: unknown;
  };
  efficacyRatings: unknown;
  titles: { tmall: unknown; jd: unknown; pdd: unknown };
  detailPage: {
    painPoint: unknown;
    fabFeature: unknown;
    fabAdvantage: unknown;
    fabBenefit: unknown;
    trustEvidence: unknown;
    contrast: unknown;
    afterSale: unknown;
  };
  darenCard: {
    top5Sp: unknown;
    script15s: unknown;
    shootingSuggestion: unknown;
    forbiddenWords: string[];
  };
  faqPreSale: unknown[];
  sellingPoints: SellingPointItem[];
  channelAssets: {
    tmallMainImage: unknown;
    xiaohongshuTitle: unknown;
    douyin3s: unknown;
    douyinScript: unknown;
    xiaohongshuContent: unknown;
  };
  dataGaps: unknown[];
  warnings: string[];
};

export type SellingPointRecord = {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedAt: string;
  brand: string;
  productName: string;
  sellingPointCount: number;
  faqCount: number;
  channelAssetCount: number;
  forbiddenWordCount: number;
  asset: SellingPointAsset;
  sourceData: Record<string, unknown>;
};

export type SellingPointRecordSummary = Omit<SellingPointRecord, "asset" | "sourceData">;

export type SellingPointTaskType =
  | "tmall_main_image"
  | "detail_page_outline"
  | "xiaohongshu_note"
  | "douyin_15s_script"
  | "customer_service_faq";

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败（HTTP ${response.status}）`);
  return payload as T;
}

export async function uploadSellingPointFile(file: File): Promise<SellingPointRecord> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/selling-points/upload", { method: "POST", body });
  const payload = await parseApiResponse<{ record: SellingPointRecord }>(response);
  return payload.record;
}

export async function fetchSellingPointRecords(): Promise<SellingPointRecordSummary[]> {
  const response = await fetch("/api/selling-points/records");
  const payload = await parseApiResponse<{ records: SellingPointRecordSummary[] }>(response);
  return payload.records;
}

export async function fetchSellingPointRecord(id: string): Promise<SellingPointRecord> {
  const response = await fetch(`/api/selling-points/records/${encodeURIComponent(id)}`);
  const payload = await parseApiResponse<{ record: SellingPointRecord }>(response);
  return payload.record;
}

export async function deleteSellingPointRecord(id: string): Promise<void> {
  const response = await fetch(`/api/selling-points/records/${encodeURIComponent(id)}`, { method: "DELETE" });
  await parseApiResponse<{ success: true }>(response);
}

export async function generateSellingPointContent(
  id: string,
  taskType: SellingPointTaskType,
  userInstruction: string
): Promise<{ result: string; filteredForbiddenWordCount: number }> {
  const response = await fetch(`/api/selling-points/records/${encodeURIComponent(id)}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType, userInstruction }),
  });
  return parseApiResponse(response);
}
