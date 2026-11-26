/**
 * ============================================================================
 * Google Apps Script: Free Data Monitoring -> Google Sheets (GET / POST JSON)
 * ============================================================================
 * หลักการทำงาน (ยืดหยุ่นตามหัวตาราง Google Sheets):
 * - คุณกำหนดหัวตารางใน "แถวที่ 1" ของ Google Sheets ได้เองเลย เช่น:
 *     Timestamp | Request Type | Temp | Hum
 *   หรือจะเพิ่ม/ลด/เปลี่ยนชื่อคอลัมน์เป็น CPU | RAM | Volt | Note ก็ได้
 * - โค้ดจะอ่านชื่อหัวตารางจากแถวที่ 1 อัตโนมัติ ไม่ต้องมาแก้โค้ดเพิ่ม!
 *   - คอลัมน์ Timestamp (หรือ เวลา)    -> ระบบใส่เวลาปัจจุบันให้อัตโนมัติ
 *   - คอลัมน์ Request Type             -> ระบบใส่ "GET" หรือ "POST" ให้อัตโนมัติ
 *   - คอลัมน์ Note (ถ้ามี)             -> รับข้อความทั่วไป
 *   - คอลัมน์อื่นๆ ที่คุณตั้งไว้เอง      -> บังคับตรวจสอบว่าเป็น "ตัวเลข" เท่านั้น
 *
 * วิธีใช้งาน:
 * 1. เตรียมหัวตารางในแถวที่ 1 ของ Google Sheets (แท็บ "Log")
 * 2. แก้ไขรหัสผ่าน #1 (FALLBACK_API_KEY) ด้านล่าง (หรือตั้ง API_KEY ใน Script Properties)
 * 3. กด Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
 * 4. ส่งข้อมูลโดยตั้งชื่อ Key ให้ตรงกับหัวตารางใน Google Sheets (ตัวพิมพ์เล็ก/ใหญ่ก็ได้):
 *    - HTTP GET  : <URL>?key=CHANGE_ME_SECRET_KEY&Temp=28.5&Hum=60.2
 *    - HTTP POST : {"key": "CHANGE_ME_SECRET_KEY", "Temp": 28.5, "Hum": 60.2}
 *
 * ข้อควรระวัง:
 * - หากแก้โค้ดนี้ ต้องกด Deploy > Manage deployments > แก้ไข > New version > Deploy
 * - ไม่ควรส่งข้อมูลถี่เกินไป (แนะนำ 10 วินาทีขึ้นไปต่อครั้ง)
 * ============================================================================
 */

// ============================================================================
// ส่วนตั้งค่า (แก้ไขแค่ 2 บรรทัดนี้พอครับ)
// ============================================================================

// #1 - แก้ตรงนี้ เป็นรหัสผ่าน (API Key) ที่คุณตั้งเอง
//      ตอนส่งข้อมูลต้องแนบ ?key=... หรือส่ง "key" มาใน JSON ด้วย
const FALLBACK_API_KEY = "CHANGE_ME_SECRET_KEY";

// #2 - แก้ตรงนี้ เป็นชื่อแท็บชีทใน Google Sheets ที่เก็บข้อมูล
const SHEET_NAME = "Log";

// ============================================================================
// ส่วนการทำงานหลัก (ไม่ต้องแก้ไข)
// ============================================================================

/**
 * รับข้อมูลผ่าน HTTP GET (Query String)
 */
function doGet(e) {
  const safeEvent = e || {};
  return handleRequest(safeEvent.parameter || {}, "GET");
}

/**
 * รับข้อมูลผ่าน HTTP POST (รองรับ JSON Body และ Query String ผสมกัน)
 */
function doPost(e) {
  const safeEvent = e || {};
  const params = safeEvent.parameter || {};
  let body = {};

  if (safeEvent.postData && safeEvent.postData.contents) {
    try {
      const parsed = JSON.parse(safeEvent.postData.contents);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed;
      } else {
        return jsonResponse_({ status: "error", code: 400, message: "JSON body must be an object" });
      }
    } catch (err) {
      return jsonResponse_({ status: "error", code: 400, message: "Invalid JSON payload" });
    }
  }

  // รวมค่าจาก URL Query และ JSON Body (ถ้าชื่อคีย์ซ้ำกัน ให้ JSON Body เป็นหลัก)
  const data = Object.assign({}, params, body);
  return handleRequest(data, "POST");
}

/**
 * ตรวจสอบ API Key -> อ่านหัวตารางแถว 1 จาก Sheets -> Validate ตัวเลข -> บันทึกแถวใหม่
 */
function handleRequest(data, requestType) {
  // 1. ตรวจสอบ API Key ก่อนเรียก Lock
  const expectedKey = getExpectedApiKey_();
  const providedKey = String(data.key ?? data.apiKey ?? "").trim();
  if (!providedKey || providedKey !== expectedKey) {
    return jsonResponse_({ status: "error", code: 401, message: "Unauthorized: Invalid API key" });
  }

  // สร้าง Map ของ Key ที่ส่งมาแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ (case-insensitive)
  const lowerData = {};
  Object.keys(data).forEach(function (k) {
    lowerData[k.trim().toLowerCase()] = data[k];
  });

  // 2. ล็อกคิวแล้วอ่านหัวตารางแถว 1 เพื่อจัดเรียงค่าให้ตรงกับ Google Sheets
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonResponse_({
        status: "error",
        code: 400,
        message: 'Sheet "' + SHEET_NAME + '" not found. Please create it with Row 1 headers.'
      });
    }

    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      return jsonResponse_({
        status: "error",
        code: 400,
        message: 'Sheet "' + SHEET_NAME + '" has no headers in Row 1.'
      });
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const row = [];
    const savedValues = {};
    let dataFieldCount = 0;

    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || "").trim();
      const norm = header.toLowerCase();

      if (!header) {
        row.push("");
        continue;
      }

      // คอลัมน์ระบบ: Timestamp / Request Type
      if (isTimestampHeader_(norm)) {
        row.push(new Date());
        continue;
      }
      if (isRequestTypeHeader_(norm)) {
        row.push(requestType);
        continue;
      }

      const hasKey = Object.prototype.hasOwnProperty.call(lowerData, norm);
      const rawVal = hasKey ? lowerData[norm] : undefined;

      // คอลัมน์ข้อความ: Note / หมายเหตุ
      if (isTextHeader_(norm)) {
        const txt = hasKey && rawVal !== null && rawVal !== undefined ? sanitizeText_(rawVal, 150) : "";
        row.push(txt);
        if (txt !== "") savedValues[header] = txt;
        continue;
      }

      // คอลัมน์ข้อมูลตัวเลขที่ผู้ใช้กำหนดในแถว 1
      const isEmpty = !hasKey || rawVal === undefined || rawVal === null || String(rawVal).trim() === "";
      if (isEmpty) {
        row.push("");
        continue;
      }

      const num = parseValidNumber_(rawVal);
      if (num === null) {
        return jsonResponse_({
          status: "error",
          code: 400,
          message: 'Invalid numeric value for "' + header + '": ' + rawVal
        });
      }

      row.push(num);
      savedValues[header] = num;
      dataFieldCount++;
    }

    if (dataFieldCount === 0) {
      return jsonResponse_({
        status: "error",
        code: 400,
        message: "No matching numeric fields found for Row 1 headers: " + headers.join(", ")
      });
    }

    sheet.appendRow(row);

    return jsonResponse_({
      status: "ok",
      requestType: requestType,
      saved: savedValues
    });
  } catch (err) {
    return jsonResponse_({ status: "error", code: 500, message: err.toString() });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function isTimestampHeader_(norm) {
  return norm === "timestamp" || norm === "time" || norm === "date" || norm === "เวลา";
}

function isRequestTypeHeader_(norm) {
  return norm === "request type" || norm === "request_type" || norm === "requesttype" || norm === "req type" || norm === "method";
}

function isTextHeader_(norm) {
  return norm === "note" || norm === "notes" || norm === "หมายเหตุ";
}

function getExpectedApiKey_() {
  const propKey = PropertiesService.getScriptProperties().getProperty("API_KEY");
  return propKey || FALLBACK_API_KEY;
}

function parseValidNumber_(raw) {
  if (raw === undefined || raw === null || typeof raw === "boolean") {
    return null;
  }
  if (typeof raw === "string" && raw.trim() === "") {
    return null;
  }
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function sanitizeText_(raw, maxLen) {
  let str = String(raw).trim().slice(0, maxLen);
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  return str;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
