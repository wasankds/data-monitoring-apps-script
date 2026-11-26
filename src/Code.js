/**
 * ============================================================================
 * Google Apps Script: Free Data Monitoring -> Google Sheets (GET / POST JSON)
 * ============================================================================
 * วิธีใช้งานเบื้องต้น:
 * 1. แก้ไขค่าในส่วนตั้งค่าด้านล่าง (#1, #2, #3) โดยเฉพาะ #1 (API Key)
 * 2. กด Save แล้วเลือก Deploy > New deployment > Web app
 *    - Execute as     : Me
 *    - Who has access : Anyone (สำคัญมาก เพื่อให้ส่งข้อมูลจากภายนอกได้)
 * 3. นำ Web App URL (/exec) ที่ได้ไปใช้งาน:
 *    - HTTP GET  (Query String):
 *      <WEB_APP_URL>?key=CHANGE_ME_SECRET_KEY&device=server01&val1=45.2&val2=62.5&note=ok
 *    - HTTP POST (Body raw JSON):
 *      {
 *        "key": "CHANGE_ME_SECRET_KEY",
 *        "device": "shelly_gen3",
 *        "val1": 28.4,
 *        "val2": 61.0,
 *        "note": "room1"
 *      }
 *
 * ข้อควรระวัง:
 * - ทุกครั้งที่แก้ไขโค้ด ต้องกด Deploy > Manage deployments > แก้ไข > New version > Deploy
 * - ไม่ควรส่งข้อมูลถี่เกินไป (แนะนำ 10 วินาทีขึ้นไปต่อครั้ง) เพื่อป้องกันการทำงานชนกันและ Quota เต็ม
 * ============================================================================
 */

// ============================================================================
// ส่วนตั้งค่าสำหรับผู้ใช้งาน (แก้ไขเฉพาะส่วนนี้ ไม่ต้องแก้โค้ดด้านล่าง)
// ============================================================================

// #1 - แก้ตรงนี้ เป็นรหัสผ่าน (API Key) ที่คุณตั้งเอง
//      เวลาส่งข้อมูลต้องแนบ ?key=... ใน URL หรือใส่ "key" ใน JSON ด้วย
//      (สำหรับใช้งานจริงบน GitHub แนะนำให้ไปตั้งตัวแปร API_KEY ใน Project Settings > Script Properties แทน)
const FALLBACK_API_KEY = "CHANGE_ME_SECRET_KEY";

// #2 - แก้ตรงนี้ เป็นชื่อแท็บชีทใน Google Sheets ที่ต้องการเก็บข้อมูล
const SHEET_NAME = "Log";

// #3 - แก้ตรงนี้ ถ้าต้องการ "เพิ่ม / ลด" คอลัมน์ค่าตัวเลข หรือเปลี่ยนชื่อ Key ที่รับเข้ามา
//      - header   : ชื่อหัวตาราง (ใช้ตอนระบบสร้างชีทใหม่ให้อัตโนมัติ)
//      - keys     : รายชื่อ Key ที่ยอมรับ (เรียงจากสำคัญสุดไปน้อยสุด ตัวแรกที่เจอค่าจะถูกนำไปใช้)
//      - required : true = บังคับต้องส่งเป็นตัวเลขเสมอ | false = ไม่ส่งมาก็ได้ (จะเว้นช่องว่างไว้)
//      * หมายเหตุ: ลำดับคอลัมน์ใน Google Sheets จะเรียงตามลำดับในรายการนี้ (Timestamp, Request Type, Device, Val1, Val2, ..., Note)
const VALUE_FIELDS = [
  { header: "Val1", keys: ["val1", "temp", "temperature", "power", "cpu"], required: true },
  { header: "Val2", keys: ["val2", "hum", "humidity", "voltage", "ram"],  required: false },
  // ตัวอย่างถ้าอยากเพิ่ม Val3: เอาเครื่องหมาย // ด้านล่างออก แล้ว Deploy เป็น New version
  // { header: "Val3", keys: ["val3", "pm25", "current"], required: false },
];

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
 * ตรวจสอบสิทธิ์ (API Key), ตรวจสอบค่าตัวเลข (Validation) และบันทึกลง Google Sheets
 */
function handleRequest(data, requestType) {
  // 1. ตรวจสอบ API Key ก่อนเรียก Lock (ป้องกันคำขอที่ไม่ผ่านสิทธิ์มาบล็อกคิว)
  const expectedKey = getExpectedApiKey_();
  const providedKey = String(data.key ?? data.apiKey ?? "").trim();
  if (!providedKey || providedKey !== expectedKey) {
    return jsonResponse_({ status: "error", code: 401, message: "Unauthorized: Invalid API key" });
  }

  // 2. ตรวจสอบและดึงค่าตัวเลขตามโครงสร้าง VALUE_FIELDS
  const numericValues = [];
  const summaryValues = {};

  for (let i = 0; i < VALUE_FIELDS.length; i++) {
    const field = VALUE_FIELDS[i];
    const raw = extractFieldValue_(data, field.keys);
    const isEmpty = raw === undefined || raw === null || String(raw).trim() === "";

    if (isEmpty) {
      if (field.required) {
        return jsonResponse_({
          status: "error",
          code: 400,
          message: "Missing required numeric field: " + field.header + " (" + field.keys.join("/") + ")"
        });
      }
      numericValues.push("");
      summaryValues[field.header] = null;
      continue;
    }

    const num = parseValidNumber_(raw);
    if (num === null) {
      return jsonResponse_({
        status: "error",
        code: 400,
        message: "Invalid numeric value for " + field.header + ": " + raw
      });
    }

    numericValues.push(num);
    summaryValues[field.header] = num;
  }

  const device = sanitizeText_(data.device || "unknown", 60);
  const note = sanitizeText_(data.note || "", 150);

  // 3. ล็อกคิวเฉพาะตอนเขียนลง Google Sheets เพื่อป้องกันข้อมูลเขียนทับกัน
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      const headers = ["Timestamp", "Request Type", "Device"]
        .concat(VALUE_FIELDS.map(function (f) { return f.header; }))
        .concat(["Note"]);
      sheet.appendRow(headers);
    }

    const row = [new Date(), requestType, device]
      .concat(numericValues)
      .concat([note]);
    sheet.appendRow(row);

    return jsonResponse_({
      status: "ok",
      requestType: requestType,
      device: device,
      values: summaryValues,
      note: note
    });
  } catch (err) {
    return jsonResponse_({ status: "error", code: 500, message: err.toString() });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * ดึง API Key จาก Script Properties ก่อน หากไม่มีจะใช้ FALLBACK_API_KEY ด้านบน
 */
function getExpectedApiKey_() {
  const propKey = PropertiesService.getScriptProperties().getProperty("API_KEY");
  return propKey || FALLBACK_API_KEY;
}

/**
 * หาค่าแรกที่ตรงกับรายชื่อ Key ใน data
 */
function extractFieldValue_(data, keys) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (Object.prototype.hasOwnProperty.call(data, k) && data[k] !== undefined) {
      return data[k];
    }
  }
  return undefined;
}

/**
 * แปลงและตรวจว่าเป็นตัวเลขที่ถูกต้อง (ปฏิเสธ NaN, Infinity, "", boolean)
 */
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

/**
 * ตัดข้อความให้ปลอดภัยจาก Google Sheets Formula Injection
 */
function sanitizeText_(raw, maxLen) {
  let str = String(raw).trim().slice(0, maxLen);
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  return str;
}

/**
 * ส่งผลลัพธ์กลับเป็น JSON
 */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
