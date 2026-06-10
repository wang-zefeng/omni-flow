import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";
import {
  analyzeTableData,
  flattenRecord,
  makeUniqueHeaders,
  normalizeCellValue,
  type TableAnalysisResult,
} from "../src/utils/tableAnalysis";

type ParsedTable = {
  headers: string[];
  rows: Record<string, unknown>[];
};

export type UploadRecord = {
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
};

const SUPPORTED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv", ".json"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function ensureDirectory(directory: string) {
  fs.mkdirSync(directory, { recursive: true });
}

function sanitizeFileName(fileName: string) {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  return `${baseName || "table"}-${Date.now()}-${randomUUID().slice(0, 8)}${extension.toLowerCase()}`;
}

function isMeaningfulHeaderRow(rawHeaders: unknown[]) {
  const headers = rawHeaders.map((value) => String(value ?? "").trim());
  const nonEmptyHeaders = headers.filter(Boolean);
  if (nonEmptyHeaders.length === 0) return false;
  return nonEmptyHeaders.some((header) => !/^[-+]?\d+(\.\d+)?$/.test(header));
}

function rowsToRecords(rawRows: unknown[][]): ParsedTable {
  if (rawRows.length === 0) {
    throw new Error("表格为空，请上传包含表头和数据行的文件。");
  }

  const rawHeaders = rawRows[0] || [];
  if (!isMeaningfulHeaderRow(rawHeaders)) {
    throw new Error("未识别到有效表头，请确保第一行是字段名称。");
  }

  const headers = makeUniqueHeaders(rawHeaders);
  const rows = rawRows.slice(1).map((values) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = normalizeCellValue(values[index]);
    });
    return record;
  }).filter((record) => headers.some((header) => String(record[header] ?? "").trim() !== ""));

  if (rows.length === 0) {
    throw new Error("表格没有有效数据行，请检查文件内容。");
  }

  return { headers, rows };
}

function parseWorkbook(filePath: string): ParsedTable {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("工作簿中没有可解析的工作表。");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return rowsToRecords(rawRows);
}

function parseCsvFile(filePath: string): ParsedTable {
  const content = fs.readFileSync(filePath, "utf8");
  const rawRows = parseCsv(content, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as unknown[][];
  return rowsToRecords(rawRows);
}

function parseJsonFile(filePath: string): ParsedTable {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const sourceRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : null;
  if (!sourceRows || sourceRows.length === 0) {
    throw new Error("JSON 必须是非空对象数组，或包含非空 data 数组。");
  }
  if (!sourceRows.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    throw new Error("JSON 数据行必须是对象，无法从基础值数组识别表头。");
  }

  const flattenedRows = sourceRows.map((row) => flattenRecord(row));
  const headers = makeUniqueHeaders(Array.from(new Set(flattenedRows.flatMap((row) => Object.keys(row)))));
  if (headers.length === 0) {
    throw new Error("JSON 对象中没有可解析字段。");
  }
  const rows = flattenedRows.map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header) => {
      record[header] = normalizeCellValue(row[header]);
    });
    return record;
  });
  return { headers, rows };
}

function parseUploadedFile(filePath: string, originalName: string): ParsedTable {
  const extension = path.extname(originalName).toLowerCase();
  if (extension === ".xlsx" || extension === ".xls") return parseWorkbook(filePath);
  if (extension === ".csv") return parseCsvFile(filePath);
  if (extension === ".json") return parseJsonFile(filePath);
  throw new Error(`不支持的文件格式：${extension || "未知"}。仅支持 .xlsx、.xls、.csv、.json。`);
}

export function createTableUploadRouter(options: {
  uploadsDir?: string;
  recordsFile?: string;
} = {}) {
  const router = Router();
  const uploadsDir = options.uploadsDir || path.join(process.cwd(), "uploads");
  const recordsFile = options.recordsFile || path.join(process.cwd(), "data", "upload-records.json");
  ensureDirectory(uploadsDir);
  ensureDirectory(path.dirname(recordsFile));

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (_req, file, callback) => callback(null, sanitizeFileName(file.originalname)),
    }),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        callback(new Error(`不支持的文件格式：${extension || "未知"}。仅支持 .xlsx、.xls、.csv、.json。`));
        return;
      }
      callback(null, true);
    },
  });

  let writeQueue: Promise<void> = Promise.resolve();

  function readRecords(): UploadRecord[] {
    if (!fs.existsSync(recordsFile)) return [];
    const content = fs.readFileSync(recordsFile, "utf8").trim();
    if (!content) return [];
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("上传记录文件格式错误，应为 JSON 数组。");
    return parsed as UploadRecord[];
  }

  function writeRecords(records: UploadRecord[]) {
    const tempFile = `${recordsFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(records, null, 2), "utf8");
    fs.renameSync(tempFile, recordsFile);
  }

  function queueRecordUpdate<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  function handleUpload(req: Request, res: Response, next: NextFunction) {
    upload.single("file")(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "文件过大，单个文件不能超过 20MB。" });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : "文件上传失败。" });
    });
  }

  router.post("/table/upload", handleUpload, async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "缺少上传文件，请使用 multipart/form-data 的 file 字段。" });
    }

    try {
      const parsed = parseUploadedFile(req.file.path, req.file.originalname);
      const analysis = analyzeTableData(parsed.headers, parsed.rows);
      const record: UploadRecord = {
        id: randomUUID(),
        fileName: req.file.originalname,
        filePath: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
        rowCount: parsed.rows.length,
        columnCount: parsed.headers.length,
        fields: analysis.fields,
        metrics: analysis.metrics,
        analysis: {
          topDimensions: analysis.topDimensions,
          dateTrend: analysis.dateTrend,
          diagnostics: analysis.diagnostics,
        },
        previewRows: parsed.rows.slice(0, 50),
        status: "parsed",
      };

      await queueRecordUpdate(() => {
        const records = readRecords();
        records.unshift(record);
        writeRecords(records);
      });

      return res.status(200).json({ success: true, fileId: record.id, record });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "文件解析失败，请检查文件内容。",
      });
    }
  });

  router.get("/table/records", (_req, res) => {
    try {
      const records = readRecords()
        .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
        .map(({ previewRows: _previewRows, ...summary }) => summary);
      return res.json({ records });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "历史记录读取失败。" });
    }
  });

  router.get("/table/records/:id", (req, res) => {
    try {
      const record = readRecords().find((item) => item.id === req.params.id);
      if (!record) return res.status(404).json({ error: "上传记录不存在或已被删除。" });
      return res.json({ record });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "上传记录读取失败。" });
    }
  });

  router.delete("/table/records/:id", async (req, res) => {
    try {
      const deleted = await queueRecordUpdate(() => {
        const records = readRecords();
        const nextRecords = records.filter((item) => item.id !== req.params.id);
        if (nextRecords.length === records.length) return false;
        writeRecords(nextRecords);
        return true;
      });
      if (!deleted) return res.status(404).json({ error: "上传记录不存在，无法删除。" });
      return res.json({ success: true, id: req.params.id });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "上传记录删除失败。" });
    }
  });

  return router;
}
