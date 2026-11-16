/**
 * 歌曲列表解析器
 *
 * 支持两种输入格式：
 *  - CSV（推荐，零依赖）：UTF-8 / UTF-8 BOM / GBK 均可，逗号或制表符分隔。
 *    建议列：`歌名,歌手`（第一列歌名，第二列歌手），可选表头行。
 *  - XLSX：因 xlsx 为 zip+XML 结构，本模块提供两种路径：
 *       a) 若工作区安装了 `xlsx` 包（`npm i xlsx`），直接解析；
 *       b) 否则要求先把 xlsx 另存为 CSV（见 README），用同一套 CSV 逻辑读取。
 *
 * 输出统一为 `[{ title, artist }]`。
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** 将字节按常见编码解码为 UTF-8 字符串。 */
export function decode(buffer) {
  // 检测并去除 UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf-8");
  }
  // 尝试 UTF-8；若含非法序列则退回 GBK（gb18030）
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return utf8;
  } catch {
    const textDecoder = new TextDecoder("gb18030");
    return textDecoder.decode(buffer);
  }
}

/** 解析 CSV 文本（支持逗号 / 制表符，按行拆分，跳过空行）。 */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 简单 CSV：按分隔符拆分第一/第二个字段
    const sep = trimmed.includes("\t") ? "\t" : ",";
    const parts = trimmed.split(sep);
    const title = (parts[0] || "").replace(/^"|"$/g, "").trim();
    const artist = (parts[1] || "").replace(/^"|"$/g, "").trim();
    if (title) rows.push({ title, artist });
  }
  return rows;
}

/** 去除可能的表头行（如 歌名/歌曲名/Title 等）。 */
export function stripHeader(rows) {
  const headerRe = /^(歌名|歌曲|标题|title|song|name)\s*$/i;
  if (rows.length && headerRe.test(rows[0].title.trim())) rows.shift();
  return rows;
}

/**
 * 从文件路径读取歌曲列表。
 * @param {string} filePath .csv 或 .xlsx 路径
 * @returns {Promise<Array<{title:string, artist:string}>>}
 */
export async function parseSongList(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    return await parseXlsx(filePath);
  }
  // 默认按 CSV/文本处理
  const buffer = await readFile(filePath);
  const text = decode(buffer);
  const rows = parseCsv(text);
  return stripHeader(rows.filter((r) => r.title && r.artist !== undefined));
}

/** 解析 XLSX（优先用 xlsx 包，缺则抛错提示转 CSV）。 */
async function parseXlsx(filePath) {
  let XLSX;
  try {
    XLSX = require("xlsx");
  } catch {
    throw new Error(
      "解析 .xlsx 需要 xlsx 支持包。请运行 `npm i xlsx`，或先把文件另存为 CSV 再使用（见 README）。"
    );
  }
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  // 兼容多种列名
  const rows = [];
  for (const row of json) {
    const title = String(row["歌名"] || row["歌曲名"] || row["标题"] || row["title"] || row["song"] || row["name"] || "").trim();
    const artist = String(row["歌手"] || row["artist"] || row["singer"] || row["作者"] || "").trim();
    if (title) rows.push({ title, artist });
  }
  return rows;
}

/** 供 CLI 显示解析结果。 */
export function summarize(rows) {
  return `${rows.length} 首歌曲`;
}