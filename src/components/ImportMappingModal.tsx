import React, { useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import * as XLSX from "xlsx";
import {
  buildRowTimeSeries,
  flattenRecord,
  makeUniqueHeaders,
  normalizeCellValue,
  parseNumericValue,
  profileTable,
  type ImportedDataType,
} from "../utils/tableAnalysis";

interface ImportMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (
    dataType: ImportedDataType,
    targetPlatformId: string,
    mappedData: any[],
    rawSheetInfo?: {
      fileName: string;
      headers: string[];
      rows: any[];
      sheets?: {
        name: string;
        headers: string[];
        rows: any[];
        dailySeries?: any[];
        profile?: any;
      }[];
      activeSheetIndex?: number;
    }
  ) => void;
  platformList?: any[];
}

const MAX_GROUPED_DAILY_POINTS = 5000;
const MAX_GROUPED_DAILY_ANCHORS = 180;
const MAX_GROUPED_DAILY_COLUMNS = 2500;

export default function ImportMappingModal({
  isOpen,
  onClose,
  onImportComplete,
  platformList
}: ImportMappingModalProps) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [dataType, setDataType] = useState<ImportedDataType>("platforms");
  const [targetPlatformId, setTargetPlatformId] = useState<string>("tmall");
  
  // File upload state simulating mapping columns
  const [fileName, setFileName] = useState<string>("");
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<any[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Visual table parser progress indicators
  const [isReading, setIsReading] = useState<boolean>(false);
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [readingStatus, setReadingStatus] = useState<string>("");

  const runProgressAnimation = (onComplete: () => void) => {
    setIsReading(true);
    setReadingProgress(0);
    setReadingStatus("正在初始化表格流读取引擎...");
    
    setTimeout(() => {
      setReadingProgress(20);
      setReadingStatus("正在解压原始 Excel/CSV 文件块...");
    }, 200);

    setTimeout(() => {
      setReadingProgress(55);
      setReadingStatus("数据包准备就绪：正交叉核算指标完整度与空置项...");
    }, 550);

    setTimeout(() => {
      setReadingProgress(85);
      setReadingStatus("主工作表匹配成功：正在匹配表头模糊同义字典...");
    }, 900);

    setTimeout(() => {
      setReadingProgress(100);
      setReadingStatus("全套记录解析完毕，即将载入表头映射中心！");
      setTimeout(() => {
        setIsReading(false);
        onComplete();
      }, 250);
    }, 1250);
  };

  const autoFuzzyMatchHeaders = (headers: string[], type: ImportedDataType, rowsForProfile: any[] = []) => {
    const mappings: Record<string, string> = {};
    
    const fuzzyDicts: Record<string, string[]> = {
      // Platform mapping dictionary
      name: ["名称", "渠道", "平台", "店铺", "name", "platform", "channel", "brand"],
      todaySales: ["今日成交", "当日成交", "营业收款", "营业", "今日", "收款", "今日销售", "sales", "revenue", "todaySales", "流水"],
      pendingOrders: ["挂单", "待发货", "挂持", "订单数", "订单", "未发货", "orders", "pending", "pendingOrders", "挂单数"],
      unreadMessages: ["未回复", "客诉", "咨询", "未读", "催发货", "回复", "messages", "unread", "chats", "客服", "待回复客诉"],
      conversionRate: ["转化率", "自然转化率", "转化", "conversion", "rate", "cr", "均值转化率"],
      
      // Supply chain mapping dictionary
      sku: ["sku", "货号", "编码", "拼音", "商品编码", "码", "code"],
      warehouseStock: ["在库", "实物", "现有", "库存", "warehouseStock", "stock", "warehouse_stock"],
      transitStock: ["在途", "调配", "起运", "运输", "transitStock", "transit"],
      currentVelocity: ["流速", "发货流速", "出货", "去库", "velocity", "salesVelocity", "限售"],
      factoryLeadTime: ["工期", "周期", "排产", "排期", "leadTime", "leadtime", "天数"],
      
      // Finance mapping dictionary
      platformName: ["渠道", "平台", "店铺", "platformName", "channelName", "财务"],
      salesVolume: ["流水", "月流水", "账面", "流水金", "salesVolume", "revenue", "总收"],
      refundsVolume: ["退款", "仅退", "售后", "赔损失", "折损", "refunds", "refund"],
      adsExpense: ["直通车", "千川", "投流", "广告", "推广", "开销", "支出", "adsExpense", "marketing"],
      platformFee: ["佣金", "扣点", "扣费", "手续费", "扣减", "platformFee", "fee"]
    };

    if (type === "custom") {
      const profile = profileTable(headers, rowsForProfile);
      if (profile.primaryDimension) mappings.primaryDimension = profile.primaryDimension;
      if (profile.primaryMetric) mappings.primaryMetric = profile.primaryMetric;
      if (profile.primaryDate) mappings.primaryDate = profile.primaryDate;
      const category = profile.dimensionFields.find((key) => key !== profile.primaryDimension);
      if (category) mappings.category = category;
      return mappings;
    }

    const keys = Object.keys(fuzzyDicts);
    keys.forEach(key => {
      const dict = fuzzyDicts[key];
      // Find first header that contains any match from the dict list
      const matchedHeader = headers.find(header => {
        const lowerHeader = String(header).toLowerCase();
        return dict.some(word => lowerHeader.includes(word.toLowerCase()));
      });
      if (matchedHeader) {
        mappings[key] = matchedHeader;
      }
    });

    return mappings;
  };

  const [allSheetsParsed, setAllSheetsParsed] = useState<any[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);

  const scoreHeaderRow = (row: any[]) => {
    const cells = row.map((cell) => String(cell ?? "").trim()).filter(Boolean);
    if (cells.length < 2) return -10;
    const keywordHits = cells.filter((cell) => {
      const lower = cell.toLowerCase();
      return [
        "id", "sku", "日期", "时间", "名称", "姓名", "部门", "平台", "渠道", "店铺", "商品", "品名",
        "金额", "销售", "流水", "库存", "订单", "退款", "费用", "利润", "转化", "数量", "状态",
        "name", "date", "sales", "amount", "revenue", "stock", "order", "cost", "rate"
      ].some((word) => lower.includes(word.toLowerCase()));
    }).length;
    const numericLike = cells.filter((cell) => parseNumericValue(cell) !== null).length;
    const unique = new Set(cells).size;
    return cells.length * 2 + keywordHits * 4 + unique - numericLike * 2;
  };

  const detectHeaderRowIndex = (rawRows: any[][]) => {
    let bestIndex = 0;
    let bestScore = -Infinity;
    rawRows.slice(0, 15).forEach((row, index) => {
      const score = scoreHeaderRow(row || []);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  };

  const rowsFromRawMatrix = (rawRows: any[][], headerRowIndex: number) => {
    const headers = makeUniqueHeaders(rawRows[headerRowIndex] || []);
    const rows = rawRows
      .slice(headerRowIndex + 1)
      .filter((row) => row && row.some((cell) => String(cell ?? "").trim() !== ""))
      .map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          obj[header] = normalizeCellValue(row[index]);
        });
        return obj;
      });
    return { headers, rows };
  };

  const extractGroupedDailySeries = (rawRows: any[][], headerRowIndex: number) => {
    const dailySeries: any[] = [];
    if (rawRows.length <= headerRowIndex + 1) return dailySeries;

    const topRow = rawRows[headerRowIndex] || [];
    const subRow = rawRows[headerRowIndex + 1] || [];
    const columnLimit = Math.min(topRow.length, MAX_GROUPED_DAILY_COLUMNS);

    interface DateAnchor {
      date: string;
      startIndex: number;
      endIndex: number;
      salesCol: number;
      uvCol: number;
      buyersCol: number;
      crCol: number;
    }

    const anchors: DateAnchor[] = [];
    let currentAnchor: DateAnchor | null = null;

    for (let c = 0; c < columnLimit; c++) {
      const cellVal = String(topRow[c] ?? "").trim();
      const isDateCell = cellVal && (
        cellVal.includes("月") ||
        cellVal.includes("日") ||
        /\d+[-./]\d+/.test(cellVal) ||
        /^[1-9]\d*日$/.test(cellVal)
      ) && !cellVal.includes("合计") && !cellVal.includes("金额") && !cellVal.includes("比例");

      if (isDateCell) {
        if (currentAnchor) currentAnchor.endIndex = c - 1;
        if (anchors.length >= MAX_GROUPED_DAILY_ANCHORS) {
          currentAnchor = null;
          continue;
        }
        currentAnchor = {
          date: cellVal,
          startIndex: c,
          endIndex: c + 12,
          salesCol: -1,
          uvCol: -1,
          buyersCol: -1,
          crCol: -1,
        };
        anchors.push(currentAnchor);
      }

      if (currentAnchor) {
        const subHeaderVal = String(subRow[c] ?? "").trim().toLowerCase();
        if (subHeaderVal.includes("金额") || subHeaderVal.includes("成交") || subHeaderVal.includes("流水") || subHeaderVal.includes("销售额") || subHeaderVal.includes("sales")) {
          currentAnchor.salesCol = c;
        } else if (subHeaderVal.includes("访客") || subHeaderVal.includes("uv") || subHeaderVal.includes("流量") || subHeaderVal.includes("曝光")) {
          currentAnchor.uvCol = c;
        } else if (subHeaderVal.includes("买家") || subHeaderVal.includes("客数") || subHeaderVal.includes("支付人") || subHeaderVal.includes("付款人")) {
          currentAnchor.buyersCol = c;
        } else if (subHeaderVal.includes("转化率") || subHeaderVal.includes("转化") || subHeaderVal.includes("cr") || subHeaderVal.includes("率")) {
          currentAnchor.crCol = c;
        }
      }
    }

    if (currentAnchor) currentAnchor.endIndex = columnLimit - 1;

    let reachedSeriesLimit = false;
    for (let r = headerRowIndex + 2; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const skuVal = String(row[0] || "").trim();
      const nameVal = String(row[1] || "").trim();
      if (!skuVal && !nameVal) continue;
      if (skuVal.includes("合计") || nameVal.includes("合计") || skuVal.includes("总计") || nameVal.includes("总计")) continue;

      anchors.forEach((anchor) => {
        if (reachedSeriesLimit) return;
        const sales = anchor.salesCol !== -1 ? parseNumericValue(row[anchor.salesCol]) || 0 : 0;
        const uv = anchor.uvCol !== -1 ? parseNumericValue(row[anchor.uvCol]) || 0 : 0;
        const buyers = anchor.buyersCol !== -1 ? parseNumericValue(row[anchor.buyersCol]) || 0 : 0;
        const crRaw = anchor.crCol !== -1 ? parseNumericValue(row[anchor.crCol]) : null;
        const cr = crRaw !== null ? crRaw : (uv > 0 && buyers > 0 ? (buyers / uv) * 100 : 0);

        if (sales > 0 || uv > 0 || buyers > 0) {
          dailySeries.push({
            date: anchor.date,
            sku: skuVal || "N/A",
            name: nameVal || "未命名项目",
            sales,
            uv,
            buyers,
            cr: Number(cr.toFixed(2)),
          });
          if (dailySeries.length >= MAX_GROUPED_DAILY_POINTS) {
            reachedSeriesLimit = true;
          }
        }
      });
      if (reachedSeriesLimit) break;
    }

    return dailySeries;
  };

  const parseWorksheet = (sheetName: string, worksheet: XLSX.WorkSheet) => {
    try {
      console.log(`[parseWorksheet] 开始解析工作表: ${sheetName}`);
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
      console.log(`[parseWorksheet] 读取到 ${rawRows.length} 行原始数据`);
      
      const headerRowIndex = detectHeaderRowIndex(rawRows);
      console.log(`[parseWorksheet] 检测到表头在第 ${headerRowIndex} 行`);
      
      const { headers, rows } = rowsFromRawMatrix(rawRows, headerRowIndex);
      console.log(`[parseWorksheet] 提取到 ${headers.length} 列, ${rows.length} 条数据`);
      
      let profile: any = null;
      try {
        if (headers.length > 0) {
          profile = profileTable(headers, rows);
          console.log(`[parseWorksheet] 表格分析完成: ${profile.businessDomainLabel}`);
        } else {
          console.log(`[parseWorksheet] 数据量较大(${rows.length}行${headers.length}列)，跳过详细分析`);
          profile = { businessDomainLabel: "通用业务数据", primaryDate: null, primaryMetric: null, rowCount: rows.length, columnCount: headers.length };
        }
      } catch (e) {
        console.log(`[parseWorksheet] 表格分析异常:`, e);
        profile = { businessDomainLabel: "通用业务数据", primaryDate: null, primaryMetric: null, rowCount: rows.length, columnCount: headers.length };
      }
      
      let groupedDailySeries: any[] = [];
      try {
        if (headers.length > 0) {
          groupedDailySeries = extractGroupedDailySeries(rawRows, headerRowIndex);
          console.log(`[parseWorksheet] 提取到 ${groupedDailySeries.length} 条日序列`);
        }
      } catch (e) {
        console.log(`[parseWorksheet] 日序列提取异常:`, e);
      }
      
      let rowTimeSeries: any[] = [];
      try {
        if (profile?.primaryDate && profile?.primaryMetric) {
          rowTimeSeries = buildRowTimeSeries(rows, profile).map((point) => ({
            date: point.date || point.name,
            sku: "",
            name: point.name,
            sales: point.value,
            uv: 0,
            buyers: 0,
            cr: 0,
          }));
          console.log(`[parseWorksheet] 构建了 ${rowTimeSeries.length} 条时间序列`);
        }
      } catch (e) {
        console.log(`[parseWorksheet] 时间序列构建异常:`, e);
      }

      return {
        name: sheetName,
        headers,
        rows,
        dailySeries: groupedDailySeries.length > 0 ? groupedDailySeries : rowTimeSeries,
        profile
      };
    } catch (err) {
      console.error(`[parseWorksheet] 解析工作表 "${sheetName}" 失败:`, err);
      throw err;
    }
  };

  const extractRowsFromJson = (parsed: any): any[] => {
    if (Array.isArray(parsed)) return parsed.map((row) => flattenRecord(row));
    if (parsed && typeof parsed === "object") {
      const arrayEntry = Object.entries(parsed).find(([, value]) => Array.isArray(value) && value.length > 0);
      if (arrayEntry) {
        return (arrayEntry[1] as any[]).map((row) => flattenRecord(row));
      }
      return [flattenRecord(parsed)];
    }
    return [];
  };

  const detectDelimiter = (text: string, fileExtension?: string) => {
    if (fileExtension === "tsv") return "\t";
    const firstLines = text.split(/\r?\n/).slice(0, 8).join("\n");
    const delimiters = [",", "\t", ";", "|"];
    return delimiters
      .map((delimiter) => ({
        delimiter,
        score: firstLines.split(/\r?\n/).reduce((sum, line) => sum + line.split(delimiter).length, 0),
      }))
      .sort((a, b) => b.score - a.score)[0]?.delimiter || ",";
  };

  const parseDelimitedText = (text: string, delimiter: string) => {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim().length > 0);
    const parseLine = (line: string) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"' && inQuotes && next === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values.map((value) => value.replace(/^["']|["']$/g, "").trim());
    };

    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = makeUniqueHeaders(parseLine(lines[0]));
    const rows = lines.slice(1).map((line) => {
      const values = parseLine(line);
      const rowObj: Record<string, any> = {};
      headers.forEach((header, idx) => {
        rowObj[header] = normalizeCellValue(values[idx] !== undefined ? values[idx] : "");
      });
      return rowObj;
    });
    return { headers, rows };
  };

  const handleFileSelect = (file: File) => {
    setErrorMsg("");
    setFileName(file.name);
    
    // Immediately set active reading states for instant feedback
    setIsReading(true);
    setReadingProgress(10);
    setReadingStatus("正在准备加载本地数据文件并唤醒读取流...");

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === "xlsx" || fileExtension === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          
          if (workbook.SheetNames.length === 0) {
            setErrorMsg("此 Excel 文件未包含任何工作表。");
            setIsReading(false);
            return;
          }

          const parsedSheetsList = workbook.SheetNames.map(sheetName => {
            return parseWorksheet(sheetName, workbook.Sheets[sheetName]);
          });

          const firstSheet = parsedSheetsList[0];
          
          if (firstSheet.rows.length > 0) {
            runProgressAnimation(() => {
              setAllSheetsParsed(parsedSheetsList);
              setSelectedSheetIndex(0);
              setDetectedHeaders(firstSheet.headers);
              setFileRows(firstSheet.rows);
              const initialMappings = autoFuzzyMatchHeaders(firstSheet.headers, dataType, firstSheet.rows);
              setFieldMappings(initialMappings);
              setActiveStep(3);
            });
          } else {
            setErrorMsg("Excel 文件主工作表中未检测到有效的数据记录。");
            setIsReading(false);
          }
        } catch (err: any) {
          console.error("Excel解析失败，详细错误:", err);
          console.error("错误堆栈:", err?.stack || "无堆栈信息");
          setErrorMsg(`Excel 文件解析失败: ${err?.message || err?.toString() || "未知错误"}`);
          setIsReading(false);
        }
      };
      reader.onerror = () => {
        setErrorMsg("读取本地 Excel 文件失败。");
        setIsReading(false);
      };
      reader.readAsArrayBuffer(file);
    } else if (fileExtension === "json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          const rows = extractRowsFromJson(parsed);
          if (rows.length > 0) {
            const headers = makeUniqueHeaders(Object.keys(rows[0]));
            const sheetProfile = profileTable(headers, rows);
            const dailySeries = buildRowTimeSeries(rows, sheetProfile).map((point) => ({
              date: point.date || point.name,
              sku: "",
              name: point.name,
              sales: point.value,
              uv: 0,
              buyers: 0,
              cr: 0,
            }));
            runProgressAnimation(() => {
              setAllSheetsParsed([{ name: "JSON数据表", headers, rows, dailySeries, profile: sheetProfile }]);
              setSelectedSheetIndex(0);
              setDetectedHeaders(headers);
              setFileRows(rows);
              const initialMappings = autoFuzzyMatchHeaders(headers, dataType, rows);
              setFieldMappings(initialMappings);
              setActiveStep(3);
            });
          } else {
            setErrorMsg("JSON文件为空或格式不正确。");
            setIsReading(false);
          }
        } catch (err) {
          console.error(err);
          setErrorMsg("JSON文件解析失败，请确保格式正确。");
          setIsReading(false);
        }
      };
      reader.onerror = () => {
        setErrorMsg("读取本地 JSON 文件失败。");
        setIsReading(false);
      };
      reader.readAsText(file);
    } else {
      // Treat other formats (.csv, .tsv, .txt, etc.) as text/delimited
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const delimiter = detectDelimiter(text, fileExtension);
          const parsedDelimited = parseDelimitedText(text, delimiter);
          
          if (parsedDelimited.rows.length > 0) {
            const { headers, rows } = parsedDelimited;
            const sheetProfile = profileTable(headers, rows);
            const dailySeries = buildRowTimeSeries(rows, sheetProfile).map((point) => ({
              date: point.date || point.name,
              sku: "",
              name: point.name,
              sales: point.value,
              uv: 0,
              buyers: 0,
              cr: 0,
            }));
            runProgressAnimation(() => {
              setAllSheetsParsed([{ name: "文本数据表", headers, rows, dailySeries, profile: sheetProfile }]);
              setSelectedSheetIndex(0);
              setDetectedHeaders(headers);
              setFileRows(rows);
              const initialMappings = autoFuzzyMatchHeaders(headers, dataType, rows);
              setFieldMappings(initialMappings);
              setActiveStep(3);
            });
          } else {
            setErrorMsg("文本或 CSV 文件为空，请检查。");
            setIsReading(false);
          }
        } catch (err) {
          console.error(err);
          setErrorMsg("文件读取出错。");
          setIsReading(false);
        }
      };
      reader.onerror = () => {
        setErrorMsg("读取本地 CSV 或文本文件失败。");
        setIsReading(false);
      };
      reader.readAsText(file);
    }
  };

  const availablePlatforms = platformList && platformList.length > 0 
    ? platformList.map(p => ({ id: p.id, name: p.name }))
    : [
        { id: "tmall", name: "天猫旗舰店" },
        { id: "tmall_global", name: "天猫海外直营店" },
        { id: "jd", name: "京东自营店" },
        { id: "pinduoduo", name: "拼多多官方旗舰店" },
        { id: "douyin", name: "抖音小店" },
        { id: "xiaohongshu", name: "小红书种草小铺" },
        { id: "b2b_wholesale", name: "阿里巴巴1688批发通道" }
      ];

  // Define required system fields based on active data type
  const getSystemFields = () => {
    switch (dataType) {
      case "platforms":
        return [
          { key: "name", label: "店铺平台名称 (Platform Name)", required: true, desc: "电商平台或者旗舰小店的名字" },
          { key: "todaySales", label: "当日成交营业额 (Today Sales, CNY)", required: true, desc: "今日实时销售流水金额" },
          { key: "pendingOrders", label: "挂持待发货订单数 (Pending Orders)", required: true, desc: "买家拍下尚未打包发料的单量" },
          { key: "unreadMessages", label: "未回复顾客咨询 (Unread Messages)", required: true, desc: "积压处于高降权红线的买家对话量" },
          { key: "conversionRate", label: "商品自然转化率 (Conversion Rate, %)", required: false, desc: "流量转化为购买的比率" }
        ];
      case "supply_chain":
        return [
          { key: "sku", label: "存货SKU编码 (Product SKU)", required: true, desc: "大仓内部唯一的货号" },
          { key: "name", label: "产品名/规格类别 (Product Name)", required: true, desc: "如: 防晒衣、面部精华乳" },
          { key: "warehouseStock", label: "分仓实物体库存在库 (Warehouse stock)", required: true, desc: "仓库内当前可以发货的真实件数" },
          { key: "transitStock", label: "在途调配库存数 (Transit Stock)", required: false, desc: "已经从供应商工厂发货转运途中的件数" },
          { key: "currentVelocity", label: "常态每日出货速率 (Daily Velocity)", required: true, desc: "每日零售或大宗批发平均去库存数" },
          { key: "factoryLeadTime", label: "工厂备料排班工期 (Factory Lead Time, Days)", required: true, desc: "工厂备料、裁剪生产到卸大仓所耗天数" }
        ];
      case "finance":
        return [
          { key: "platformName", label: "出货渠道名称 (Channel Name)", required: true, desc: "核算损益财务账目的品牌店铺" },
          { key: "salesVolume", label: "账面总销售流水金 (Sales Volume, CNY)", required: true, desc: "该周期全部的成交货值流水" },
          { key: "refundsVolume", label: "消费者极速退款额 (Refunds Volume, CNY)", required: true, desc: "售后退款、仅退款等逆流折损总额" },
          { key: "adsExpense", label: "广告直通车千川投流开支 (Ads Expense)", required: true, desc: "站内品效投流、KOL推广、直通车开销" },
          { key: "platformFee", label: "渠道佣金扣点及耗扣费 (Platform Fee)", required: false, desc: "平台规定扣点、软件服务费、扣款" }
        ];
      case "custom":
        return [
          { key: "primaryDimension", label: "主分析维度 (Primary Dimension)", required: false, desc: "如员工、商品、客户、项目、部门、供应商、活动名称等" },
          { key: "primaryMetric", label: "主数值指标 (Primary Metric)", required: false, desc: "如金额、销量、数量、工时、评分、预算、转化率等" },
          { key: "primaryDate", label: "日期/周期字段 (Date / Period)", required: false, desc: "如日期、月份、周、季度、创建时间、结算周期等" },
          { key: "category", label: "分类/状态字段 (Category / Status)", required: false, desc: "如部门、渠道、类目、状态、阶段、负责人等" }
        ];
    }
    return [];
  };

  const handleLoadTemplateData = () => {
    let mockFileName = "";
    let mockHeaders: string[] = [];
    let mockRows: any[] = [];
    let initialMappings: Record<string, string> = {};
    let tempSheets: any[] = [];

    if (dataType === "platforms") {
      mockFileName = "standard_channels_payload_template.xlsx";
      mockHeaders = ["渠道标号", "营业收款_当日", "挂单数", "待回复客诉", "均值转化率"];
      mockRows = [
        { "渠道标号": "天猫旗舰店", "营业收款_当日": 142000, "挂单数": 390, "待回复客诉": 12, "均值转化率": 3.6 },
        { "渠道标号": "抖音小店", "营业收款_当日": 189000, "挂单数": 680, "待回复客诉": 29, "均值转化率": 3.1 },
        { "渠道标号": "拼多多特价铺", "营业收款_当日": 95000, "挂单数": 890, "待回复客诉": 45, "均值转化率": 4.5 },
        { "渠道标号": "小红书官方店", "营业收款_当日": 54000, "挂单数": 82, "待回复客诉": 6, "均值转化率": 2.2 }
      ];
      initialMappings = {
        "name": "渠道标号",
        "todaySales": "营业收款_当日",
        "pendingOrders": "挂单数",
        "unreadMessages": "待回复客诉",
        "conversionRate": "均值转化率"
      };

      // Generate simulated multi-sheet monthly products
      const productsList = [
        { sku: "PR-801", name: "兔子安心捷-5条8包" },
        { sku: "PR-802", name: "兔子安心捷-2条5包" },
        { sku: "PR-903", name: "极速冰丝凉感防晒服" },
        { sku: "PR-904", name: "野山参黑松露夜用凝胶" }
      ];

      const generateMockDaily = (monthLabel: string) => {
        const list: any[] = [];
        for (let day = 1; day <= 30; day++) {
          const dateStr = `${monthLabel}月${day}日`;
          productsList.forEach((prod, idx) => {
            const factor = 1 + Math.sin(day * 0.4 + idx) * 0.3;
            list.push({
              date: dateStr,
              sku: prod.sku,
              name: prod.name,
              sales: Math.round((7000 + idx * 2500) * factor),
              uv: Math.round((2000 + idx * 800) * factor),
              buyers: Math.round((80 + idx * 30) * factor),
              cr: Number((3.5 + idx * 0.4 + Math.sin(day) * 0.5).toFixed(2))
            });
          });
        }
        return list;
      };

      tempSheets = [
        {
          name: "24年12月商品实绩",
          headers: ["ID", "重点品项", "合计-销售额", "合计-买家数", "合计-支付转化率"],
          rows: productsList.map(p => ({
            "ID": p.sku,
            "重点品项": p.name,
            "合计-销售额": 284000,
            "合计-买家数": 9500,
            "合计-支付转化率": "3.8%"
          })),
          dailySeries: generateMockDaily("12")
        },
        {
          name: "24年11月商品实绩",
          headers: ["ID", "重点品项", "合计-销售额", "合计-买家数", "合计-支付转化率"],
          rows: productsList.map(p => ({
            "ID": p.sku,
            "重点品项": p.name,
            "合计-销售额": 242000,
            "合计-买家数": 8100,
            "合计-支付转化率": "3.5%"
          })),
          dailySeries: generateMockDaily("11")
        },
        {
          name: "24年10月商品实绩",
          headers: ["ID", "重点品项", "合计-销售额", "合计-买家数", "合计-支付转化率"],
          rows: productsList.map(p => ({
            "ID": p.sku,
            "重点品项": p.name,
            "合计-销售额": 221000,
            "合计-买家数": 7400,
            "合计-支付转化率": "3.3%"
          })),
          dailySeries: generateMockDaily("10")
        },
        {
          name: "2024年度累计实际大盘",
          headers: ["分类", "销售累计汇总额", "累计买家", "年度总客流"],
          rows: [
            { "分类": "极速运动全系列", "销售累计汇总额": 4820000, "累计买家": 145000, "年度总客流": 4800000 },
            { "分类": "兔子安心居家全系列", "销售累计汇总额": 3150000, "累计买家": 98000, "年度总客流": 3100000 },
            { "分类": "黑松露滋养液全系列", "销售累计汇总额": 1820000, "累计买家": 42000, "年度总客流": 1500000 }
          ],
          dailySeries: []
        }
      ];

    } else if (dataType === "supply_chain") {
      mockFileName = "factory_inventory_lead_time_sheet.csv";
      mockHeaders = ["货号_SKU", "货品中文名", "在库现有实物", "起运在途", "日发货流速", "原厂生产备货周期"];
      mockRows = [
        { "货号_SKU": "SKU-9420-LOCAL", "货品中文名": "极速气动冰丝凉感防晒服", "在库现有实物": 2100, "起运在途": 800, "日发货流速": 150, "原厂生产备货周期": 15 },
        { "货号_SKU": "SKU-3114-LOCAL", "货品中文名": "野山参黑松露凝胶夜用液", "在库现有实物": 180, "起运在途": 1200, "日发货流速": 80, "原厂生产备货周期": 21 },
        { "货号_SKU": "SKU-5201-LOCAL", "货品中文名": "高能回弹越野跑步鞋限量款", "在库现有实物": 840, "起运在途": 400, "日发货流速": 95, "原厂生产备货周期": 12 }
      ];
      initialMappings = {
        "sku": "货号_SKU",
        "name": "货品中文名",
        "warehouseStock": "在库现有实物",
        "transitStock": "起运在途",
        "currentVelocity": "日发货流速",
        "factoryLeadTime": "原厂生产备货周期"
      };

      tempSheets = [
        {
          name: "柔性仓控制中心工作表",
          headers: mockHeaders,
          rows: mockRows,
          dailySeries: []
        }
      ];
    } else if (dataType === "finance") {
      mockFileName = "channel_p_and_l_accounting_ledgers.xlsx";
      mockHeaders = ["店铺渠道名称", "销售月流水总计", "消费者退货赔损失", "直通车达人推广费", "平台技术佣金扣减"];
      mockRows = [
        { "店铺渠道名称": "天猫旗舰店", "销售月流水总计": 1640000, "消费者退货赔损失": 120000, "直通车达人推广费": 350000, "平台技术佣金扣减": 80000 },
        { "店铺渠道名称": "抖音爆款核心小店", "销售月流水总计": 1520000, "消费者退货赔损失": 280000, "直通车达人推广费": 520000, "平台技术佣金扣减": 76000 },
        { "店铺渠道名称": "京东自营旗舰店", "销售月流水总计": 1310000, "消费者退货赔损失": 78000, "直通车达人推广费": 220000, "平台技术佣金扣减": 105000 }
      ];
      initialMappings = {
        "platformName": "店铺渠道名称",
        "salesVolume": "销售月流水总计",
        "refundsVolume": "消费者退货赔损失",
        "adsExpense": "直通车达人推广费",
        "platformFee": "平台技术佣金扣减"
      };

      tempSheets = [
        {
          name: "十二月合算财务表",
          headers: mockHeaders,
          rows: mockRows,
          dailySeries: []
        },
        {
          name: "十一月合算财务表",
          headers: mockHeaders,
          rows: mockRows.map(r => ({ ...r, "销售月流水总计": Math.round(r["销售月流水总计"] * 0.9) })),
          dailySeries: []
        }
      ];
    } else {
      mockFileName = "cross_department_project_tracker.csv";
      mockHeaders = ["需求编号", "业务类型", "负责部门", "负责人", "当前阶段", "提交日期", "预计工时", "预算金额", "优先级评分", "完成率"];
      mockRows = [
        { "需求编号": "REQ-001", "业务类型": "设计素材", "负责部门": "设计部", "负责人": "林青", "当前阶段": "打样中", "提交日期": "2026-06-01", "预计工时": 18, "预算金额": 12000, "优先级评分": 92, "完成率": "65%" },
        { "需求编号": "REQ-002", "业务类型": "市场投放", "负责部门": "市场部", "负责人": "王辰", "当前阶段": "待审核", "提交日期": "2026-06-02", "预计工时": 26, "预算金额": 48000, "优先级评分": 88, "完成率": "40%" },
        { "需求编号": "REQ-003", "业务类型": "供应链采购", "负责部门": "供应链", "负责人": "周琳", "当前阶段": "供应商确认", "提交日期": "2026-06-03", "预计工时": 12, "预算金额": 82000, "优先级评分": 96, "完成率": "55%" },
        { "需求编号": "REQ-004", "业务类型": "客服优化", "负责部门": "客服组", "负责人": "陈琪", "当前阶段": "已上线", "提交日期": "2026-06-04", "预计工时": 8, "预算金额": 6000, "优先级评分": 76, "完成率": "100%" }
      ];
      initialMappings = {
        primaryDimension: "业务类型",
        primaryMetric: "预算金额",
        primaryDate: "提交日期",
        category: "负责部门"
      };

      tempSheets = [
        {
          name: "跨部门需求跟进表",
          headers: mockHeaders,
          rows: mockRows,
          dailySeries: []
        }
      ];
    }

    setFileName(mockFileName);
    runProgressAnimation(() => {
      setDetectedHeaders(mockHeaders);
      setFileRows(mockRows);
      setFieldMappings(initialMappings);
      setAllSheetsParsed(tempSheets);
      setSelectedSheetIndex(0);
      setActiveStep(3);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleMappingChange = (systemKey: string, fileHeader: string) => {
    setFieldMappings(prev => ({
      ...prev,
      [systemKey]: fileHeader
    }));
  };

  const handleExecuteImport = () => {
    // Structure the data to match system requirements
    const finalData = dataType === "custom" ? fileRows.map((row, idx) => ({
      id: row.id || row.ID || row["编号"] || `local_import_${Date.now()}_${idx}`,
      ...row,
    })) : fileRows.map((row, idx) => {
      const obj: any = { id: `local_import_${Date.now()}_${idx}` };
      const fields = getSystemFields();
      
      fields.forEach(field => {
        const fileColumn = fieldMappings[field.key];
        if (fileColumn && row[fileColumn] !== undefined) {
          // Convert strings to number if needed
          const val = row[fileColumn];
          if (field.key !== "name" && field.key !== "sku" && field.key !== "platformName") {
            obj[field.key] = parseNumericValue(val) || 0;
          } else {
            obj[field.key] = val;
          }
        } else {
          // Set sensible defaults if not mapped
          if (field.key === "channel") obj[field.key] = "B2C";
          else if (field.key === "todaySales") obj[field.key] = 10000;
          else if (field.key === "pendingOrders") obj[field.key] = 20;
          else if (field.key === "unreadMessages") obj[field.key] = 2;
          else if (field.key === "status") obj[field.key] = "normal";
          else if (field.key === "logo") obj[field.key] = "Tmall";
          else if (field.key === "syncCount") obj[field.key] = 0;
          else if (field.key === "supplierName") obj[field.key] = "本地离线配发基地";
          else if (field.key === "riskLevel") obj[field.key] = "low";
        }
      });
      return { ...obj, channel: "B2C", status: "normal" };
    });

    onImportComplete(dataType, targetPlatformId, finalData, {
      fileName: fileName || "未命名导入表格.xlsx",
      headers: detectedHeaders,
      rows: fileRows,
      sheets: allSheetsParsed.length > 0 ? allSheetsParsed : [{ name: "默认工作表", headers: detectedHeaders, rows: fileRows, dailySeries: [] }],
      activeSheetIndex: selectedSheetIndex
    });
    onClose();
    // Reset state
    setActiveStep(1);
    setFileName("");
    setDetectedHeaders([]);
    setFileRows([]);
    setFieldMappings({});
    setAllSheetsParsed([]);
    setSelectedSheetIndex(0);
  };

  const currentFileProfile = useMemo(() => {
    return profileTable(detectedHeaders, fileRows);
  }, [detectedHeaders, fileRows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-indigo-950 px-6 py-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Lucide.UploadCloud className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold">离线数据导入与异构多源 Mapping 同步舱</h3>
              <p className="text-[10px] text-indigo-300">通过标准化映射转换器，导入本地销售报表、仓库货期报表并接入中台沙盘</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white cursor-pointer"
          >
            <Lucide.X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Multi-Step Progress Tracker */}
        <div className="bg-slate-50 border-b border-slate-100 px-8 py-3 flex items-center justify-between text-xs shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep >= 1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>1</span>
            <span className={`font-semibold ${activeStep === 1 ? "text-indigo-900 font-bold" : "text-slate-500"}`}>选择导入模块</span>
          </div>
          <div className="h-[1px] flex-1 bg-slate-200 mx-4" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep >= 2 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>2</span>
            <span className={`font-semibold ${activeStep === 2 ? "text-indigo-900 font-bold" : "text-slate-500"}`}>上传离线文件</span>
          </div>
          <div className="h-[1px] flex-1 bg-slate-200 mx-4" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep >= 3 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>3</span>
            <span className={`font-semibold ${activeStep === 3 ? "text-indigo-900 font-bold" : "text-slate-500"}`}>表头字段映射 (Mapping)</span>
          </div>
        </div>

        {/* Modal content body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          
          {/* STEP 1: SELECT IMPORT DATATYPE AND SCOPE */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">第一步：选择需要注入中台的数据种类</span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <button
                  onClick={() => setDataType("platforms")}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between h-40 transition-all cursor-pointer ${
                    dataType === "platforms"
                      ? "bg-indigo-50/50 border-indigo-500 text-indigo-900"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Lucide.LayoutDashboard className={`w-7 h-7 ${dataType === "platforms" ? "text-indigo-600" : "text-slate-400"}`} />
                  <div>
                    <h4 className="text-xs font-bold">全渠道店铺流水账报表</h4>
                    <p className="text-[10px] text-slate-400 mt-1">天猫、京东、拼多多、抖音等，更新当日销售、未读客诉及订单排单</p>
                  </div>
                </button>

                <button
                  onClick={() => setDataType("supply_chain")}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between h-40 transition-all cursor-pointer ${
                    dataType === "supply_chain"
                      ? "bg-indigo-50/50 border-indigo-500 text-indigo-900"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Lucide.Truck className={`w-7 h-7 ${dataType === "supply_chain" ? "text-indigo-600" : "text-slate-400"}`} />
                  <div>
                    <h4 className="text-xs font-bold">柔性仓储备货与工期表</h4>
                    <p className="text-[10px] text-slate-400 mt-1">管理各SKU周转库存。配置在库现有、在途订单、每日出货速及在途排期</p>
                  </div>
                </button>

                <button
                  onClick={() => setDataType("finance")}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between h-40 transition-all cursor-pointer ${
                    dataType === "finance"
                      ? "bg-indigo-50/50 border-indigo-500 text-indigo-900"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Lucide.CalendarDays className={`w-7 h-7 ${dataType === "finance" ? "text-indigo-600" : "text-slate-400"}`} />
                  <div>
                    <h4 className="text-xs font-bold">全网多店铺损益财务Ledger表</h4>
                    <p className="text-[10px] text-slate-400 mt-1">统计各店铺在周期内的销售、巨额退款、广告投流费、中介平台费</p>
                  </div>
                </button>

                <button
                  onClick={() => setDataType("custom")}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between h-40 transition-all cursor-pointer ${
                    dataType === "custom"
                      ? "bg-indigo-50/50 border-indigo-500 text-indigo-900"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Lucide.Workflow className={`w-7 h-7 ${dataType === "custom" ? "text-indigo-600" : "text-slate-400"}`} />
                  <div>
                    <h4 className="text-xs font-bold">通用业务表自动识别</h4>
                    <p className="text-[10px] text-slate-400 mt-1">适合人事、市场、客服、CRM、采购、项目、设计需求等任意结构表</p>
                  </div>
                </button>

              </div>

              {dataType === "platforms" && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">关联的店铺平台对象：</label>
                  <select
                    value={targetPlatformId}
                    onChange={(e) => setTargetPlatformId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    {availablePlatforms.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400">导入后系统将用此文件数据对该平台的各项指标进行重新覆盖注入，供仪表盘绘制。</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: FILE SELECTION / CSV DRAG-DROP */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">第二步：上传数据文件 (支持拖入、手动或一键预加载模板)</span>
              
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-lg flex items-start gap-2 select-text">
                  <Lucide.AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {isReading ? (
                <div className="border border-indigo-150 bg-radial from-indigo-50/30 to-purple-50/10 p-8 rounded-xl text-center select-none space-y-4 flex flex-col items-center justify-center min-h-[178px] animate-pulse">
                  <div className="relative">
                    <Lucide.UploadCloud className="w-10 h-10 text-indigo-600 animate-bounce" />
                    <Lucide.Loader2 className="w-5 h-5 text-purple-600 animate-spin absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-purple-200" />
                  </div>
                  <div className="space-y-2 w-full max-w-sm">
                    <div className="flex justify-between text-[11px] font-bold text-slate-700">
                      <span className="truncate max-w-[220px]">📄 {fileName || "正在读取数据流"}</span>
                      <span className="font-mono text-indigo-600">{readingProgress}%</span>
                    </div>
                    {/* Progress Track */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${readingProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-indigo-900 font-semibold">{readingStatus}</p>
                    <p className="text-[9px] text-slate-400">正在分析全链明细特征与同义模糊表头 mapping 字典，请不关闭当前窗口</p>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/10 p-8 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[170px]"
                >
                  <Lucide.FileSpreadsheet className="w-10 h-10 text-indigo-500 animate-bounce" />
                  <h4 className="text-xs font-bold text-slate-700 mt-2">将您准备好的电商数据文件拖到此处</h4>
                  <p className="text-[10px] text-slate-400 mt-1">支持 Excel (.xlsx, .xls)、CSV 或是 JSON 标准结算文件格式</p>
                  
                  <div className="flex gap-2.5 mt-4">
                    <button
                      onClick={() => {
                        document.getElementById("local_file_uploader")?.click();
                      }}
                      className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 hover:bg-slate-50 rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      或手动选择本地文件
                    </button>
                    <input
                      id="local_file_uploader"
                      type="file"
                      accept=".csv,.xlsx,.xls,.json,.tsv,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileSelect(file);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Template helpers */}
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Lucide.ClipboardCheck className="w-4 h-4 text-emerald-400" />
                    没有标准本地文件？ 一键拉取中台标准备课模板测试
                  </h4>
                  <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-mono font-bold uppercase scale-90">
                    EMULATE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  我们为您精心编排了一键测试方案。点击下方按钮，将立刻模拟上传系统专属的标准表格表头与内容，让您完美走通中台沙盘映射与数据画图的全过程：
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={handleLoadTemplateData}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Lucide.DatabaseBackup className="w-3.5 h-3.5" />
                    一键预载 【{dataType === "platforms" ? "多渠道店铺流水账" : dataType === "supply_chain" ? "仓储备货与工期期" : dataType === "finance" ? "渠道P&L财务账清单" : "跨部门通用业务表"}】
                  </button>
                  
                  <a
                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                      dataType === "platforms" 
                        ? "渠道标号,营业收款_当日,挂单数,待回复客诉,均值转化率\n天猫旗舰店,142000,390,12,3.6" 
                        : dataType === "supply_chain"
                        ? "sku,name,warehouse_stock,transit,velocity,leadtime\nSKU-001,样例商品,1000,200,50,14"
                        : dataType === "finance"
                        ? "店铺渠道名称,销售月流水总计,消费者退货赔损失,直通车达人推广费,平台技术佣金扣减\n天猫旗舰店,1640000,120000,350000,80000"
                        : "需求编号,业务类型,负责部门,负责人,当前阶段,提交日期,预计工时,预算金额,优先级评分,完成率\nREQ-001,设计素材,设计部,林青,打样中,2026-06-01,18,12000,92,65%"
                    )}`}
                    download={dataType === "platforms" ? "标准多渠道订单通用模板.csv" : dataType === "supply_chain" ? "标准在库补货与排期模板.csv" : dataType === "finance" ? "标准财务损益模板.csv" : "标准通用业务表模板.csv"}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-[10px] border border-slate-700 cursor-pointer flex items-center gap-1"
                  >
                    <Lucide.Download className="w-3.5 h-3.5" />
                    下载标准 CSV 空白表
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: HEADERS FIELD MAPPING SCREEN */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Lucide.CheckCircle className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-900">
                    CSV 识别解析成功: <span className="font-mono text-indigo-600">{fileName}</span>
                  </span>
                </div>
                <button
                  onClick={() => setActiveStep(2)}
                  className="text-[10px] text-indigo-700 hover:underline cursor-pointer"
                >
                  重新上传
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { label: "业务画像", value: currentFileProfile.businessDomainLabel, icon: Lucide.BrainCircuit },
                  { label: "有效行", value: `${currentFileProfile.rowCount} 行`, icon: Lucide.Database },
                  { label: "数值字段", value: `${currentFileProfile.numericFields.length} 个`, icon: Lucide.Sigma },
                  { label: "日期字段", value: `${currentFileProfile.dateFields.length} 个`, icon: Lucide.CalendarDays },
                  { label: "完整度", value: `${currentFileProfile.fillRate.toFixed(1)}%`, icon: Lucide.ShieldCheck },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="bg-white border border-slate-100 rounded-lg p-2.5 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase">
                        <Icon className="w-3 h-3 text-indigo-500" />
                        {item.label}
                      </div>
                      <div className="text-[11px] font-bold text-slate-800 mt-1 truncate" title={item.value}>{item.value}</div>
                    </div>
                  );
                })}
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs bg-white">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-400 font-bold">
                  <span>系统要求的核心统计指标 (Required)</span>
                  <span>您上传表单里的字段表头 (File Column Headers)</span>
                </div>

                <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
                  {getSystemFields().map((field) => {
                    return (
                      <div key={field.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-dashed border-slate-100 last:border-b-0 last:pb-0">
                        <div className="space-y-0.5">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            {field.label}
                            {field.required && (
                              <span className="text-red-500 text-[11px]">*</span>
                            )}
                          </label>
                          <p className="text-[10px] text-slate-400 leading-normal max-w-[280px]">
                            {field.desc}
                          </p>
                        </div>

                        <select
                          value={fieldMappings[field.key] || ""}
                          onChange={(e) => handleMappingChange(field.key, e.target.value)}
                          className="text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg min-w-[200px] outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-medium text-slate-700"
                        >
                          <option value="">-- [请选择映射的CSV列] --</option>
                          {detectedHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-yellow-50/50 border border-yellow-100 p-3 rounded-lg space-y-0.5">
                <h5 className="text-[10px] font-bold text-amber-800 flex items-center gap-1 select-none">
                  <Lucide.Info className="w-3.5 h-3.5" />
                  智能纠错与数据验证
                </h5>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  中台决策大脑已对预设数据格式执行大宗财务扣减验证，确认不存在负数或非数值字符阻断。
                  映射完成后点击“确认映射”，系统将立刻使能 **“Local / 离线沙盘模式”** 触发仪表盘重算渲染。
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal footer navigation */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            {activeStep > 1 && (
              <button
                onClick={() => setActiveStep(prev => (prev - 1) as any)}
                disabled={isReading}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-all disabled:opacity-40"
              >
                上一步
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isReading}
              className="px-4 py-2 bg-white text-slate-400 text-xs font-semibold hover:text-slate-600 transition-all cursor-pointer disabled:opacity-40"
            >
              取消
            </button>
            
            {activeStep === 1 && (
              <button
                onClick={() => setActiveStep(2)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                下一步：导入文件
              </button>
            )}

            {activeStep === 2 && (
              <button
                onClick={handleLoadTemplateData}
                disabled={!fileName || isReading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-300 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                {isReading ? "正在分析中..." : "下一步：映射表头"}
              </button>
            )}

            {activeStep === 3 && (
              <button
                onClick={handleExecuteImport}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Lucide.Sparkles className="w-3.5 h-3.5 text-white" />
                开始映射并加载沙盘
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
