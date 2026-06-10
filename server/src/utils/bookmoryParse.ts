import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { BookFormat } from "@prisma/client";

/** Parsed from Bookmory exports; not stored on books anymore. */
type ParsedBookStatus =
  | "TO_READ"
  | "READING"
  | "READ"
  | "DID_NOT_FINISH"
  | "ON_HOLD";

export type BookmoryField =
  | "title"
  | "author"
  | "isbn"
  | "isbn13"
  | "publisher"
  | "numberOfPages"
  | "yearPublished"
  | "status"
  | "rating"
  | "dateAdded"
  | "dateStarted"
  | "dateFinished"
  | "currentPage"
  | "pagesRead"
  | "tags"
  | "collections"
  | "notes"
  | "coverImageUrl"
  | "format"
  | "wishlist"
  | "library"
  | "purchasePrice"
  | "totalReadMinutes"
  | "externalId";

/** Normalized header → our field. Supports English + common variants. */
const BOOKMORY_HEADER_ALIASES: Record<string, BookmoryField> = {
  title: "title",
  "book title": "title",
  name: "title",
  titel: "title",
  author: "author",
  authors: "author",
  writer: "author",
  auteur: "author",
  autor: "author",
  isbn: "isbn",
  "isbn-10": "isbn",
  isbn10: "isbn",
  "isbn-13": "isbn13",
  isbn13: "isbn13",
  publisher: "publisher",
  verlag: "publisher",
  pages: "numberOfPages",
  "total pages": "numberOfPages",
  "number of pages": "numberOfPages",
  page: "numberOfPages",
  seiten: "numberOfPages",
  "year published": "yearPublished",
  year: "yearPublished",
  "publication year": "yearPublished",
  status: "status",
  "reading status": "status",
  "read status": "status",
  state: "status",
  rating: "rating",
  "star rating": "rating",
  score: "rating",
  stars: "rating",
  "date added": "dateAdded",
  added: "dateAdded",
  "start date": "dateStarted",
  started: "dateStarted",
  "started on": "dateStarted",
  "start reading": "dateStarted",
  "reading start": "dateStarted",
  "read period": "dateStarted",
  "end date": "dateFinished",
  finished: "dateFinished",
  "finished on": "dateFinished",
  "finish date": "dateFinished",
  "date read": "dateFinished",
  "date finished": "dateFinished",
  completed: "dateFinished",
  "current page": "currentPage",
  "last page": "currentPage",
  progress: "currentPage",
  "page progress": "currentPage",
  "pages read": "pagesRead",
  "read pages": "pagesRead",
  "total pages read": "pagesRead",
  tags: "tags",
  tag: "tags",
  labels: "tags",
  collections: "collections",
  collection: "collections",
  shelves: "collections",
  shelf: "collections",
  memo: "notes",
  note: "notes",
  notes: "notes",
  review: "notes",
  comment: "notes",
  cover: "coverImageUrl",
  "cover url": "coverImageUrl",
  "cover image": "coverImageUrl",
  "image url": "coverImageUrl",
  format: "format",
  type: "format",
  "book type": "format",
  binding: "format",
  wishlist: "wishlist",
  "to purchase": "wishlist",
  purchased: "wishlist",
  library: "library",
  "in library": "library",
  catalog: "library",
  price: "purchasePrice",
  cost: "purchasePrice",
  "purchase price": "purchasePrice",
  "total read time": "totalReadMinutes",
  "total reading time": "totalReadMinutes",
  "read time": "totalReadMinutes",
  "reading time": "totalReadMinutes",
  "time read": "totalReadMinutes",
  "minutes read": "totalReadMinutes",
  "total readtime": "totalReadMinutes",
  "readtime": "totalReadMinutes",
  "total read time (min)": "totalReadMinutes",
  "reading duration": "totalReadMinutes",
  "read duration": "totalReadMinutes",
  "total reading duration": "totalReadMinutes",
  "time spent reading": "totalReadMinutes",
  "time spent": "totalReadMinutes",
  "spent time": "totalReadMinutes",
  "total time": "totalReadMinutes",
  goodreadsid: "externalId",
  "goodreads id": "externalId",
  "goodreads book id": "externalId",
  "gr id": "externalId",
};

export interface ParsedBookmoryRow {
  sourceRow: number;
  raw: Record<string, string>;
  title: string;
  author: string | null;
  isbn: string | null;
  isbn13: string | null;
  publisher: string | null;
  numberOfPages: number | null;
  yearPublished: number | null;
  status: ParsedBookStatus;
  rating: number | null;
  dateAdded: Date | null;
  dateStarted: Date | null;
  dateFinished: Date | null;
  currentPage: number | null;
  pagesRead: number | null;
  tags: string[];
  collections: string[];
  notes: string | null;
  coverImageUrl: string | null;
  format: BookFormat | null;
  toPurchase: boolean;
  inLibrary: boolean;
  purchasePrice: number | null;
  totalReadMinutes: number | null;
  totalReadTimeRaw: string | null;
  externalId: string | null;
  warnings: string[];
}

function parseGoodreadsIdValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  const urlMatch = trimmed.match(/goodreads\.com\/book\/show\/(\d+)/i);
  return urlMatch?.[1] ?? null;
}

export interface BookmoryParseResult {
  format: "xlsx" | "csv" | "json";
  headers: string[];
  columnMapping: Record<string, BookmoryField>;
  headerRowIndex: number;
  rows: ParsedBookmoryRow[];
  parseWarnings: string[];
}

function normalizeHeader(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]+/g, " ");
}

function readTimeColumnPriority(header: string): number {
  const key = normalizeHeader(header).replace(/\s/g, "");
  if (key === "totalreadtime") return 0;
  if (key === "totalreadingtime") return 1;
  if (key.includes("total") && key.includes("read") && key.includes("time")) {
    return 2;
  }
  if (key.includes("read") && key.includes("time")) return 3;
  if (key === "duration") return 90;
  return 50;
}

function getReadTimeColumnValues(
  row: Record<string, string>,
  mapping: Record<string, BookmoryField>,
): string[] {
  return Object.entries(mapping)
    .filter(([, field]) => field === "totalReadMinutes")
    .map(([column]) => column)
    .sort((a, b) => readTimeColumnPriority(a) - readTimeColumnPriority(b))
    .map((column) => row[column]?.trim() ?? "")
    .filter(Boolean);
}

function isReadTimeHeader(normalizedKey: string): boolean {
  const compact = normalizedKey.replace(/\s/g, "");
  return (
    /totalreadtime|totalreadingtime|readtime|readingduration|totalreadingduration/.test(
      compact,
    ) ||
    (compact.includes("read") &&
      (compact.includes("time") || compact.includes("duration"))) ||
    (compact.includes("time") && compact.includes("spent"))
  );
}

function looksLikeReadDurationValue(value: string): boolean {
  const trimmed = value.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return false;
  if (/\d+h/i.test(trimmed) || /\d+m/i.test(trimmed)) return true;
  if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(trimmed)) return true;
  const asNumber = Number.parseFloat(trimmed.replace(",", "."));
  return !Number.isNaN(asNumber) && asNumber > 0 && asNumber < 1;
}

export function detectBookmoryColumnMapping(
  headers: string[],
): Record<string, BookmoryField> {
  const mapping: Record<string, BookmoryField> = {};
  for (const header of headers) {
    const key = normalizeHeader(header);
    if (BOOKMORY_HEADER_ALIASES[key]) {
      mapping[header] = BOOKMORY_HEADER_ALIASES[key];
    } else if (isReadTimeHeader(key)) {
      mapping[header] = "totalReadMinutes";
    }
  }
  return mapping;
}

function scoreHeaderRow(cells: string[]): number {
  let score = 0;
  for (const cell of cells) {
    const key = normalizeHeader(String(cell ?? ""));
    if (BOOKMORY_HEADER_ALIASES[key]) score += 1;
    if (isReadTimeHeader(key)) score += 0.5;
  }
  return score;
}

function findHeaderRowIndex(matrix: string[][]): number {
  let bestIdx = 0;
  let bestScore = 0;
  const limit = Math.min(8, matrix.length);
  for (let i = 0; i < limit; i++) {
    const score = scoreHeaderRow(matrix[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Bookmory exports sometimes split headers across two rows (metadata + labels). */
function mergeHeaderRows(matrix: string[][], headerRowIndex: number): string[] {
  const primary = matrix[headerRowIndex] ?? [];
  const secondary =
    headerRowIndex > 0 ? (matrix[headerRowIndex - 1] ?? []) : [];
  const width = Math.max(primary.length, secondary.length);
  const merged: string[] = [];

  for (let col = 0; col < width; col++) {
    const fromPrimary = String(primary[col] ?? "").trim();
    const fromSecondary = String(secondary[col] ?? "").trim();
    merged.push(fromPrimary || fromSecondary);
  }

  return merged;
}

function getFieldValue(
  row: Record<string, string>,
  mapping: Record<string, BookmoryField>,
  field: BookmoryField,
): string {
  const column = Object.entries(mapping).find(([, f]) => f === field)?.[0];
  if (!column) return "";
  return row[column]?.trim() ?? "";
}

function parseOptionalInt(value: string): number | null {
  if (!value) return null;
  const n = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function parseOptionalFloat(value: string): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const periodPart = trimmed.split("~")[0]?.trim() ?? trimmed;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(periodPart);
  if (dmy) {
    const day = Number.parseInt(dmy[1], 10);
    const month = Number.parseInt(dmy[2], 10);
    const year = Number.parseInt(dmy[3], 10);
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed.slice(0, 10) + "T12:00:00.000Z");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const excelSerial = Number(trimmed);
  if (!Number.isNaN(excelSerial) && excelSerial > 20000 && excelSerial < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(excelSerial));
    return epoch;
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function splitList(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapBookmoryStatus(raw: string): ParsedBookStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return "TO_READ";

  if (
    /^(read|finished|done|complete|completed|gelesen|fini|terminé|terminado)$/.test(
      s,
    ) ||
    s.includes("finished") ||
    s.includes("completed") ||
    s.includes("read it all")
  ) {
    return "READ";
  }
  if (
    /^(reading|currently reading|in progress|progress|am lesen|en cours)$/.test(
      s,
    ) ||
    s.includes("currently")
  ) {
    return "READING";
  }
  if (
    /^(paused|on hold|hold|hiatus|pause|en pause)$/.test(s) ||
    s.includes("hold") ||
    s.includes("hiatus")
  ) {
    return "ON_HOLD";
  }
  if (
    /^(dropped|dnf|did not finish|abandoned|abgebrochen)$/.test(s) ||
    s.includes("did not") ||
    s.includes("dropped") ||
    s.includes("gave up")
  ) {
    return "DID_NOT_FINISH";
  }
  if (
    /^(to read|want to read|wishlist|planned|tbr|unread|queue|backlog)$/.test(
      s,
    ) ||
    s.includes("want") ||
    s.includes("wish")
  ) {
    return "TO_READ";
  }

  return "TO_READ";
}

function mapBookmoryFormat(raw: string): BookFormat | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("audio") || s.includes("audiobook")) return "AUDIO";
  if (
    s.includes("ebook") ||
    s.includes("e-book") ||
    s.includes("digital") ||
    s.includes("kindle") ||
    s.includes("epub") ||
    s.includes("pdf")
  ) {
    return "DIGITAL";
  }
  if (s.includes("physical") || s.includes("paper") || s.includes("hardcover")) {
    return "PHYSICAL";
  }
  return null;
}

function parseWishlistFlag(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return false;
  return ["yes", "true", "1", "y", "wishlist", "to purchase", "want"].some(
    (v) => s === v || s.includes(v),
  );
}

function parseLibraryFlag(raw: string): boolean {
  return raw.trim().toLowerCase() === "true";
}

function normalizeDurationText(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[：﹕]/g, ":")
    .replace(/\u00a0/g, " ")
    .trim();
}

/** Bookmory/Excel sometimes stores clock values as HHMMSS integers (e.g. 84318 → 08:43:18). */
function parseCompactHhmmssNumber(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 1000 || n > 235959) return null;

  const digits = String(n).padStart(6, "0");
  const hours = Number.parseInt(digits.slice(0, 2), 10);
  const mins = Number.parseInt(digits.slice(2, 4), 10);
  const secs = Number.parseInt(digits.slice(4, 6), 10);
  if (hours >= 24 || mins >= 60 || secs >= 60) return null;

  const total = hours * 60 + mins + Math.round(secs / 60);
  return total > 0 ? total : null;
}

/** Parse Bookmory "Total read time" values (e.g. 1h 15m, 5h, 11m, Excel duration). */
export function parseReadTimeMinutes(raw: string): number | null {
  const trimmed = normalizeDurationText(raw);
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  const hoursMatch = /(\d+(?:[.,]\d+)?)\s*h(?:ours?|rs?)?/i.exec(lower);
  const minsMatch = /(\d+(?:[.,]\d+)?)\s*m(?:in(?:utes?)?|ins?)?/i.exec(lower);
  if (hoursMatch || minsMatch) {
    const hours = hoursMatch
      ? Number.parseFloat(hoursMatch[1].replace(",", "."))
      : 0;
    const mins = minsMatch
      ? Number.parseFloat(minsMatch[1].replace(",", "."))
      : 0;
    const total = Math.round(hours * 60 + mins);
    return total > 0 ? total : null;
  }

  const hmsMatch = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (hmsMatch) {
    const total =
      Number.parseInt(hmsMatch[1], 10) * 60 +
      Number.parseInt(hmsMatch[2], 10) +
      Math.round(Number.parseInt(hmsMatch[3], 10) / 60);
    return total > 0 ? total : null;
  }

  const hmMatch = /^(\d+):(\d{1,2})$/.exec(trimmed);
  if (hmMatch) {
    const total =
      Number.parseInt(hmMatch[1], 10) * 60 + Number.parseInt(hmMatch[2], 10);
    return total > 0 ? total : null;
  }

  const asNumber = Number.parseFloat(trimmed.replace(",", "."));
  if (!Number.isNaN(asNumber) && asNumber > 0) {
    // Excel duration serial: fraction of a day (e.g. 0.0625 = 90 minutes)
    if (asNumber > 0 && asNumber < 1) {
      const fromDayFraction = Math.round(asNumber * 24 * 60);
      return fromDayFraction > 0 ? fromDayFraction : null;
    }

    if (Number.isInteger(asNumber) || Math.abs(asNumber - Math.round(asNumber)) < 0.0001) {
      const fromCompact = parseCompactHhmmssNumber(asNumber);
      if (fromCompact != null) return fromCompact;
    }

    // Plain minutes (e.g. 75) — only for modest values, not HHMMSS integers
    if (asNumber < 1000) {
      return Math.round(asNumber);
    }

    // Seconds (e.g. 4500 = 75 minutes)
    if (asNumber >= 3600) {
      return Math.round(asNumber / 60);
    }
  }

  return null;
}

function readTimeRawFromRecord(
  record: Record<string, string>,
  mapping: Record<string, BookmoryField>,
): string | null {
  if (record[BOOKMORY_READ_TIME_KEY]?.trim()) {
    return record[BOOKMORY_READ_TIME_KEY].trim();
  }

  for (const value of getReadTimeColumnValues(record, mapping)) {
    if (value.trim()) return value.trim();
  }

  for (const [header, value] of Object.entries(record)) {
    if (!value.trim()) continue;
    if (normalizeHeader(header) === "total read time") return value.trim();
  }

  return (
    Object.values(record).find(
      (value) => /\d+h/i.test(value) || /\d+m/i.test(value),
    ) ?? null
  );
}

function parseTotalReadMinutesFromRecord(
  record: Record<string, string>,
  mapping: Record<string, BookmoryField>,
): number | null {
  const injected = record[BOOKMORY_READ_TIME_KEY]?.trim();
  if (injected) {
    const parsed = parseReadTimeMinutes(injected);
    if (parsed != null) return parsed;
  }

  for (const [header, value] of Object.entries(record)) {
    if (!value.trim()) continue;
    if (normalizeHeader(header) !== "total read time") continue;
    const parsed = parseReadTimeMinutes(value);
    if (parsed != null) return parsed;
  }

  for (const value of getReadTimeColumnValues(record, mapping)) {
    const parsed = parseReadTimeMinutes(value);
    if (parsed != null) return parsed;
  }

  for (const [header, value] of Object.entries(record)) {
    if (!value.trim()) continue;
    const key = normalizeHeader(header);
    if (!key.includes("read") || !key.includes("time")) continue;
    if (mapping[header] && mapping[header] !== "totalReadMinutes") continue;
    const parsed = parseReadTimeMinutes(value);
    if (parsed != null) return parsed;
  }

  const skipFields = new Set<BookmoryField>([
    "title",
    "author",
    "isbn",
    "isbn13",
    "publisher",
    "numberOfPages",
    "pagesRead",
    "yearPublished",
    "rating",
    "purchasePrice",
    "status",
    "notes",
    "tags",
    "collections",
    "coverImageUrl",
    "format",
    "wishlist",
    "library",
    "dateAdded",
    "dateStarted",
    "dateFinished",
    "currentPage",
  ]);

  for (const [header, value] of Object.entries(record)) {
    if (!value.trim()) continue;
    const mappedField = mapping[header];
    if (mappedField && skipFields.has(mappedField)) continue;
    if (!/\d+h/i.test(value) && !/\d+m/i.test(value) && !looksLikeReadDurationValue(value)) {
      continue;
    }
    const parsed = parseReadTimeMinutes(value);
    if (parsed != null) return parsed;
  }

  return null;
}

function formatCellNumber(cell: XLSX.CellObject): string | null {
  if (typeof cell.v !== "number" || Number.isNaN(cell.v)) return null;
  if (cell.z && typeof XLSX.SSF?.format === "function") {
    try {
      const formatted = String(XLSX.SSF.format(cell.z, cell.v)).trim();
      if (formatted && !formatted.includes("#")) return formatted;
    } catch {
      /* fall through */
    }
  }
  return String(cell.v);
}

function cellToExportString(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";

  if (cell.r && Array.isArray(cell.r)) {
    const rich = cell.r
      .map((part) => {
        if (typeof part === "object" && part && "v" in part) {
          return String(part.v ?? "");
        }
        return "";
      })
      .join("");
    if (rich.trim()) return rich.trim();
  }

  const formatted = typeof cell.w === "string" ? cell.w.trim() : "";
  if (formatted) return formatted;

  const cellType = cell.t as string | undefined;
  if (
    (cellType === "s" || cellType === "str" || cellType === "inlineStr") &&
    typeof cell.v === "string"
  ) {
    return cell.v.trim();
  }

  if (typeof cell.v === "number" && !Number.isNaN(cell.v)) {
    return formatCellNumber(cell) ?? String(cell.v);
  }

  if (cell.v instanceof Date) {
    const hours = cell.v.getUTCHours();
    const minutes = cell.v.getUTCMinutes();
    const seconds = cell.v.getUTCSeconds();
    if (hours > 0 || minutes > 0 || seconds > 0) {
      return seconds > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${hours}:${String(minutes).padStart(2, "0")}`;
    }
  }

  if (cell.v == null) return "";
  return String(cell.v).trim();
}

function getSheetCellRange(sheet: XLSX.WorkSheet): XLSX.Range {
  let start = { r: 0, c: 0 };
  let end = { r: 0, c: 0 };
  let hasRange = false;

  if (sheet["!ref"]) {
    const decoded = XLSX.utils.decode_range(sheet["!ref"]);
    start = decoded.s;
    end = decoded.e;
    hasRange = true;
  }

  for (const key of Object.keys(sheet)) {
    if (key[0] === "!") continue;
    try {
      const addr = XLSX.utils.decode_cell(key);
      if (!hasRange) {
        start = { ...addr };
        end = { ...addr };
        hasRange = true;
        continue;
      }
      start.r = Math.min(start.r, addr.r);
      start.c = Math.min(start.c, addr.c);
      end.r = Math.max(end.r, addr.r);
      end.c = Math.max(end.c, addr.c);
    } catch {
      /* skip invalid keys */
    }
  }

  return { s: start, e: end };
}

function applyMergedCellsToMatrix(
  sheet: XLSX.WorkSheet,
  matrix: string[][],
  rangeStart: { r: number; c: number },
): void {
  for (const range of sheet["!merges"] ?? []) {
    const origin = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c })];
    const value = cellToExportString(origin);
    if (!value) continue;

    for (let row = range.s.r; row <= range.e.r; row++) {
      const matrixRow = row - rangeStart.r;
      if (matrixRow < 0 || matrixRow >= matrix.length) continue;
      if (!matrix[matrixRow]) matrix[matrixRow] = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const matrixCol = col - rangeStart.c;
        if (matrixCol < 0) continue;
        if (!matrix[matrixRow][matrixCol]?.trim()) {
          matrix[matrixRow][matrixCol] = value;
        }
      }
    }
  }
}

function sheetToStringMatrix(sheet: XLSX.WorkSheet): string[][] {
  const range = getSheetCellRange(sheet);
  const matrix: string[][] = [];

  for (let row = range.s.r; row <= range.e.r; row++) {
    const line: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      line.push(cellToExportString(sheet[address]));
    }
    matrix.push(line);
  }

  applyMergedCellsToMatrix(sheet, matrix, range.s);

  // Fallback: sheet_to_json sometimes resolves formatted strings our cell walk misses.
  const fallbackRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      raw: false,
      range,
    },
  ) as (string | number | null)[][];

  for (let row = 0; row < matrix.length; row++) {
    const fallback = fallbackRows[row] ?? [];
    for (let col = 0; col < (matrix[row]?.length ?? 0); col++) {
      if (matrix[row][col]?.trim()) continue;
      const value = String(fallback[col] ?? "").trim();
      if (value) matrix[row][col] = value;
    }
  }

  return matrix;
}

function findReadTimeColumnInMatrix(
  matrix: string[][],
  maxRows = 15,
): { row: number; col: number; label: string } | null {
  const limit = Math.min(maxRows, matrix.length);
  for (let row = 0; row < limit; row++) {
    const cells = matrix[row] ?? [];
    for (let col = 0; col < cells.length; col++) {
      const label = String(cells[col] ?? "").trim();
      if (!label) continue;
      if (isReadTimeHeader(normalizeHeader(label))) {
        return { row, col, label };
      }
    }
  }
  return null;
}

function discoverReadTimeColumnByValues(
  matrix: string[][],
  headerRowIndex: number,
  skipColumns: Set<number>,
): number {
  const counts = new Map<number, number>();
  const sampleEnd = Math.min(matrix.length, headerRowIndex + 25);

  for (let row = headerRowIndex + 1; row < sampleEnd; row++) {
    const line = matrix[row] ?? [];
    line.forEach((cell, col) => {
      if (skipColumns.has(col)) return;
      const text = String(cell ?? "").trim();
      if (!text) return;
      // Prefer Bookmory text durations (1h 15m) over clock strings from wrong columns.
      if (/\d+h/i.test(text) || /\d+m/i.test(text)) {
        counts.set(col, (counts.get(col) ?? 0) + 3);
        return;
      }
      if (looksLikeReadDurationValue(text)) {
        counts.set(col, (counts.get(col) ?? 0) + 1);
      }
    });
  }

  let bestColumn = -1;
  let bestCount = 0;
  for (const [col, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestColumn = col;
    }
  }

  return bestCount >= 1 ? bestColumn : -1;
}

const BOOKMORY_READ_TIME_KEY = "__bookmoryReadTime";
const BOOKMORY_READ_PERIOD_KEY = "__bookmoryReadPeriod";

function countBookmoryDurationCells(
  matrix: string[][],
  headerRowIndex: number,
  col: number,
): number {
  if (col < 0) return 0;
  let count = 0;
  const end = Math.min(matrix.length, headerRowIndex + 100);
  for (let row = headerRowIndex + 1; row < end; row++) {
    const text = String(matrix[row]?.[col] ?? "").trim();
    if (!text) continue;
    if (/\d+h/i.test(text) || /\d+m/i.test(text)) count += 3;
    else if (looksLikeReadDurationValue(text)) count += 1;
  }
  return count;
}

function resolveReadTimeColumn(
  matrix: string[][],
  headers: string[],
  columnMapping: Record<string, BookmoryField>,
  headerRowIndex: number,
): number {
  let headerCol = -1;
  for (const [header, field] of Object.entries(columnMapping)) {
    if (field !== "totalReadMinutes") continue;
    headerCol = headers.indexOf(header);
    break;
  }

  const headerMatch = findReadTimeColumnInMatrix(matrix);
  if (headerMatch && headerCol < 0) {
    headerCol = headerMatch.col;
  }

  const skipColumns = new Set<number>();
  for (const [header, field] of Object.entries(columnMapping)) {
    if (field === "totalReadMinutes") continue;
    const col = headers.indexOf(header);
    if (col >= 0) skipColumns.add(col);
  }

  const valueCol = discoverReadTimeColumnByValues(
    matrix,
    headerRowIndex,
    skipColumns,
  );

  const headerScore = countBookmoryDurationCells(matrix, headerRowIndex, headerCol);
  const valueScore = countBookmoryDurationCells(matrix, headerRowIndex, valueCol);
  const bestCol =
    valueScore > headerScore ? valueCol : headerCol >= 0 ? headerCol : valueCol;

  if (bestCol < 0) return -1;

  while (headers.length <= bestCol) {
    headers.push(`Column ${headers.length + 1}`);
  }

  const label =
    headerMatch?.col === bestCol
      ? headerMatch.label
      : headers[bestCol]?.trim() && !headers[bestCol].startsWith("Column ")
        ? headers[bestCol]
        : "Total read time";

  headers[bestCol] = label;
  for (const [header, field] of Object.entries({ ...columnMapping })) {
    if (field === "totalReadMinutes") delete columnMapping[header];
  }
  columnMapping[label] = "totalReadMinutes";

  return bestCol;
}

function resolveReadPeriodColumn(
  matrix: string[][],
  headers: string[],
  headerRowIndex: number,
): number {
  for (let row = 0; row < Math.min(15, matrix.length); row++) {
    for (let col = 0; col < (matrix[row]?.length ?? 0); col++) {
      const label = normalizeHeader(String(matrix[row]?.[col] ?? ""));
      if (label === "read period") return col;
    }
  }

  let bestCol = -1;
  let bestCount = 0;
  const end = Math.min(matrix.length, headerRowIndex + 50);
  for (let col = 0; col < (headers.length || 0); col++) {
    let count = 0;
    for (let row = headerRowIndex + 1; row < end; row++) {
      const text = String(matrix[row]?.[col] ?? "").trim();
      if (text.includes("~") && /\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestCol = col;
    }
  }

  return bestCount > 0 ? bestCol : -1;
}

function padMatrixRows(matrix: string[][]): string[][] {
  const width = matrix.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);
  return matrix.map((row) => {
    const padded = [...(row ?? [])];
    while (padded.length < width) padded.push("");
    return padded;
  });
}

function rowRecordsFromMatrix(matrix: string[][]): {
  headers: string[];
  records: Record<string, string>[];
  headerRowIndex: number;
} {
  const normalizedMatrix = padMatrixRows(matrix);
  const headerRowIndex = findHeaderRowIndex(normalizedMatrix);
  const headerRow = mergeHeaderRows(normalizedMatrix, headerRowIndex);
  const headers = headerRow.map((h, i) => {
    const label = String(h ?? "").trim();
    return label || `Column ${i + 1}`;
  });
  const columnMapping = detectBookmoryColumnMapping(headers);
  const readTimeCol = resolveReadTimeColumn(
    normalizedMatrix,
    headers,
    columnMapping,
    headerRowIndex,
  );
  const readPeriodCol = resolveReadPeriodColumn(
    normalizedMatrix,
    headers,
    headerRowIndex,
  );
  const titleColumn =
    Object.entries(columnMapping).find(([, field]) => field === "title")?.[0] ??
    headers[0];

  const records: Record<string, string>[] = [];
  for (let i = headerRowIndex + 1; i < normalizedMatrix.length; i++) {
    const line = normalizedMatrix[i] ?? [];
    if (line.every((cell) => !String(cell ?? "").trim())) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, col) => {
      record[header] = String(line[col] ?? "").trim();
    });

    if (readTimeCol >= 0) {
      const readTime = String(line[readTimeCol] ?? "").trim();
      if (readTime) {
        record[BOOKMORY_READ_TIME_KEY] = readTime;
        record["Total read time"] = readTime;
      }
    }

    if (readPeriodCol >= 0) {
      const readPeriod = String(line[readPeriodCol] ?? "").trim();
      if (readPeriod) {
        record[BOOKMORY_READ_PERIOD_KEY] = readPeriod;
        record["Read period"] = readPeriod;
      }
    }

    if (record[titleColumn]?.trim()) {
      records.push(record);
    }
  }

  return { headers, records, headerRowIndex };
}

function excelCellToString(cell: ExcelJS.Cell): string {
  const text = cell.text?.trim();
  if (text) return text;

  const value = cell.value;
  if (value == null) return "";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (value instanceof Date) {
    const hours = value.getUTCHours();
    const minutes = value.getUTCMinutes();
    const seconds = value.getUTCSeconds();
    if (hours > 0 || minutes > 0 || seconds > 0) {
      return seconds > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${hours}:${String(minutes).padStart(2, "0")}`;
    }
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text ?? "")
        .join("")
        .trim();
    }
    if ("result" in value && value.result != null) {
      return excelCellToString({ text: String(value.result), value: value.result } as ExcelJS.Cell);
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
  }

  return String(value).trim();
}

function worksheetToMatrix(worksheet: ExcelJS.Worksheet): string[][] {
  const dims = worksheet.dimensions;
  const top = dims?.top ?? 1;
  const left = dims?.left ?? 1;
  const bottom = dims?.bottom ?? worksheet.rowCount;
  const right = dims?.right ?? worksheet.columnCount;
  const matrix: string[][] = [];

  for (let row = top; row <= bottom; row++) {
    const line: string[] = [];
    for (let col = left; col <= right; col++) {
      line.push(excelCellToString(worksheet.getCell(row, col)));
    }
    matrix.push(line);
  }

  return matrix;
}

function pickBestExcelWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  let bestSheet: ExcelJS.Worksheet | null = null;
  let bestRows = 0;

  for (const worksheet of workbook.worksheets) {
    const matrix = worksheetToMatrix(worksheet);
    const headerRowIndex = findHeaderRowIndex(matrix);
    const headers = mergeHeaderRows(matrix, headerRowIndex).map((h, i) => {
      const label = String(h ?? "").trim();
      return label || `Column ${i + 1}`;
    });
    const mapping = detectBookmoryColumnMapping(headers);
    if (!Object.values(mapping).includes("title")) continue;

    const dataRows = matrix
      .slice(headerRowIndex + 1)
      .filter((row) => row.some((cell) => cell.trim())).length;
    if (dataRows > bestRows) {
      bestRows = dataRows;
      bestSheet = worksheet;
    }
  }

  return bestSheet ?? workbook.worksheets[0] ?? null;
}

async function parseSpreadsheetRows(buffer: Buffer): Promise<{
  headers: string[];
  records: Record<string, string>[];
  headerRowIndex: number;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = pickBestExcelWorksheet(workbook);
  if (!worksheet) {
    return { headers: [], records: [], headerRowIndex: 0 };
  }
  return rowRecordsFromMatrix(worksheetToMatrix(worksheet));
}

function parseCsvRows(content: string): {
  headers: string[];
  records: Record<string, string>[];
  headerRowIndex: number;
} {
  const matrix = content
    .split(/\r?\n/)
    .map((line) => {
      const parsed = Papa.parse<string[]>(line, { header: false });
      return (parsed.data[0] ?? []).map((c) => String(c ?? ""));
    })
    .filter((row) => row.some((cell) => cell.trim()));

  if (matrix.length === 0) {
    return { headers: [], records: [], headerRowIndex: 0 };
  }

  const headerScore = scoreHeaderRow(matrix[0] ?? []);
  if (headerScore >= 2) {
    return rowRecordsFromMatrix(matrix);
  }

  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  return {
    headers,
    records: parsed.data,
    headerRowIndex: 0,
  };
}

function flattenJsonBook(item: Record<string, unknown>): Record<string, string> {
  const flat: Record<string, string> = {};
  const assign = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === "object" && !Array.isArray(value)) return;
    flat[key] = Array.isArray(value) ? value.join(", ") : String(value);
  };

  for (const [key, value] of Object.entries(item)) {
    assign(key, value);
  }

  const nestedKeys = [
    ["title", item.title ?? item.bookTitle ?? item.name],
    ["author", item.author ?? item.authorName ?? item.authors],
    ["isbn", item.isbn ?? item.isbn10],
    ["isbn13", item.isbn13],
    ["publisher", item.publisher ?? item.publisherName],
    ["numberOfPages", item.numberOfPages ?? item.pages ?? item.pageCount],
    ["status", item.status ?? item.readingStatus ?? item.readStatus],
    ["rating", item.rating ?? item.starRating ?? item.score],
    ["dateAdded", item.dateAdded ?? item.addedAt],
    ["dateStarted", item.dateStarted ?? item.startedAt ?? item.startDate],
    ["dateFinished", item.dateFinished ?? item.finishedAt ?? item.endDate],
    ["currentPage", item.currentPage ?? item.progressPage ?? item.lastPage],
    ["pagesRead", item.pagesRead ?? item.totalPagesRead],
    ["tags", item.tags],
    ["collections", item.collections ?? item.shelves],
    ["notes", item.notes ?? item.memo ?? item.review],
    ["coverImageUrl", item.coverImageUrl ?? item.coverUrl ?? item.cover],
    ["format", item.format ?? item.bookType],
    ["wishlist", item.wishlist ?? item.toPurchase],
    ["library", item.library ?? item.inLibrary],
    ["purchasePrice", item.purchasePrice ?? item.price],
    ["totalReadMinutes", item.totalReadMinutes ?? item.totalReadTime ?? item.readTime],
  ] as const;

  for (const [key, value] of nestedKeys) {
    if (value !== undefined && value !== null && !flat[key]) {
      assign(key, value);
    }
  }

  return flat;
}

function parseJsonRows(content: string): {
  headers: string[];
  records: Record<string, string>[];
  headerRowIndex: number;
} {
  const data = JSON.parse(content) as unknown;
  let items: Record<string, unknown>[] = [];

  if (Array.isArray(data)) {
    items = data.filter(
      (x): x is Record<string, unknown> =>
        typeof x === "object" && x !== null && !Array.isArray(x),
    );
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const candidate =
      obj.books ??
      obj.library ??
      obj.items ??
      obj.data ??
      obj.records ??
      obj.bookList;
    if (Array.isArray(candidate)) {
      items = candidate.filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null && !Array.isArray(x),
      );
    }
  }

  const records = items.map(flattenJsonBook);
  const headerSet = new Set<string>();
  for (const record of records) {
    Object.keys(record).forEach((k) => headerSet.add(k));
  }
  const headers = [...headerSet];
  return { headers, records, headerRowIndex: 0 };
}

function convertRecord(
  record: Record<string, string>,
  mapping: Record<string, BookmoryField>,
  sourceRow: number,
): ParsedBookmoryRow | null {
  const title = getFieldValue(record, mapping, "title");
  if (!title) return null;

  const author = getFieldValue(record, mapping, "author") || null;
  const statusRaw = getFieldValue(record, mapping, "status");
  const wishlistRaw = getFieldValue(record, mapping, "wishlist");
  const libraryRaw = getFieldValue(record, mapping, "library");
  const warnings: string[] = [];

  if (!author) {
    warnings.push("No author — will import without primary author if allowed");
  }

  const ratingRaw = parseOptionalFloat(getFieldValue(record, mapping, "rating"));
  const rating =
    ratingRaw !== null
      ? Math.min(5, Math.max(1, Math.round(ratingRaw <= 5 ? ratingRaw : ratingRaw / 2)))
      : null;

  const pagesRead =
    parseOptionalInt(getFieldValue(record, mapping, "pagesRead")) ??
    parseOptionalInt(getFieldValue(record, mapping, "currentPage"));

  const externalIdRaw = getFieldValue(record, mapping, "externalId");
  const externalId = externalIdRaw ? parseGoodreadsIdValue(externalIdRaw) : null;
  if (externalIdRaw && !externalId) {
    warnings.push(`Could not parse Goodreads Id "${externalIdRaw}"`);
  }

  return {
    sourceRow,
    raw: record,
    title,
    author,
    isbn: getFieldValue(record, mapping, "isbn") || null,
    isbn13: getFieldValue(record, mapping, "isbn13") || null,
    publisher: getFieldValue(record, mapping, "publisher") || null,
    numberOfPages: parseOptionalInt(
      getFieldValue(record, mapping, "numberOfPages"),
    ),
    yearPublished: parseOptionalInt(
      getFieldValue(record, mapping, "yearPublished"),
    ),
    status: mapBookmoryStatus(statusRaw),
    rating,
    dateAdded: parseDate(getFieldValue(record, mapping, "dateAdded")),
    dateStarted: (() => {
      const readPeriod =
        record[BOOKMORY_READ_PERIOD_KEY] ??
        Object.entries(record).find(
          ([header]) => normalizeHeader(header) === "read period",
        )?.[1];
      if (readPeriod?.trim()) {
        const start = parseDate(readPeriod.split("~")[0]?.trim() ?? "");
        if (start) return start;
      }
      return parseDate(getFieldValue(record, mapping, "dateStarted"));
    })(),
    dateFinished: (() => {
      const readPeriod =
        record[BOOKMORY_READ_PERIOD_KEY] ??
        Object.entries(record).find(
          ([header]) => normalizeHeader(header) === "read period",
        )?.[1];
      if (readPeriod?.includes("~")) {
        const end = parseDate(readPeriod.split("~")[1]?.trim() ?? "");
        if (end) return end;
      }
      return parseDate(getFieldValue(record, mapping, "dateFinished"));
    })(),
    currentPage: parseOptionalInt(getFieldValue(record, mapping, "currentPage")),
    pagesRead,
    tags: splitList(getFieldValue(record, mapping, "tags")),
    collections: splitList(getFieldValue(record, mapping, "collections")),
    notes: getFieldValue(record, mapping, "notes") || null,
    coverImageUrl: getFieldValue(record, mapping, "coverImageUrl") || null,
    format: mapBookmoryFormat(getFieldValue(record, mapping, "format")),
    toPurchase: parseWishlistFlag(wishlistRaw),
    inLibrary: parseLibraryFlag(libraryRaw),
    purchasePrice: parseOptionalFloat(getFieldValue(record, mapping, "purchasePrice")),
    totalReadMinutes: parseTotalReadMinutesFromRecord(record, mapping),
    totalReadTimeRaw: readTimeRawFromRecord(record, mapping),
    externalId,
    warnings,
  };
}

export async function parseBookmoryFile(
  buffer: Buffer,
  fileName: string,
): Promise<BookmoryParseResult> {
  const lower = fileName.toLowerCase();
  const parseWarnings: string[] = [];

  let format: BookmoryParseResult["format"];
  let headers: string[] = [];
  let records: Record<string, string>[] = [];
  let headerRowIndex = 0;

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    format = "xlsx";
    const parsed = await parseSpreadsheetRows(buffer);
    headers = parsed.headers;
    records = parsed.records;
    headerRowIndex = parsed.headerRowIndex;
    if (headerRowIndex > 0) {
      parseWarnings.push(
        `Skipped ${headerRowIndex} row(s) before the detected header row (common in Bookmory exports).`,
      );
    }
  } else if (lower.endsWith(".csv")) {
    format = "csv";
    const parsed = parseCsvRows(buffer.toString("utf-8"));
    headers = parsed.headers;
    records = parsed.records;
    headerRowIndex = parsed.headerRowIndex;
  } else if (lower.endsWith(".json")) {
    format = "json";
    try {
      const parsed = parseJsonRows(buffer.toString("utf-8"));
      headers = parsed.headers;
      records = parsed.records;
      headerRowIndex = parsed.headerRowIndex;
    } catch {
      throw new Error("Invalid JSON backup file");
    }
  } else {
    throw new Error("Unsupported file type. Use .xlsx, .csv, or .json from Bookmory export.");
  }

  const columnMapping = detectBookmoryColumnMapping(headers);
  const mappedFieldCount = new Set(Object.values(columnMapping)).size;

  if (!columnMapping || !Object.values(columnMapping).includes("title")) {
    throw new Error(
      "Could not find a Title column. Export from Bookmory as Excel (recommended) with English headers, or check the file format.",
    );
  }

  if (mappedFieldCount < 2) {
    parseWarnings.push(
      "Few columns were auto-detected. Preview the mapping below; you can still import if Title is present.",
    );
  }

  if (!Object.values(columnMapping).includes("totalReadMinutes")) {
    parseWarnings.push(
      'No "Total read time" column was detected. Reading time will not be imported — check that your Bookmory export includes that column.',
    );
  }

  const rows: ParsedBookmoryRow[] = [];
  records.forEach((record, index) => {
    const row = convertRecord(
      record,
      columnMapping,
      headerRowIndex + index + 2,
    );
    if (row) rows.push(row);
  });

  if (rows.length === 0) {
    throw new Error("No book rows found in the file.");
  }

  return {
    format,
    headers,
    columnMapping,
    headerRowIndex,
    rows,
    parseWarnings,
  };
}
