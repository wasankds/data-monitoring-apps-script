# data-monitoring-apps-script

ระบบบันทึกข้อมูล Monitoring เข้า Google Sheets ฟรี ด้วย Google Apps Script (รองรับทั้ง `HTTP GET` และ `HTTP POST JSON`)

## โครงสร้างคอลัมน์ในชีท (`Log`)
`Timestamp` | `Request Type` | `Device` | `Val1` | `Val2` | `Note`

> สามารถเพิ่ม/ลดคอลัมน์ค่าตัวเลข (`Val3`, `Val4`, ...) หรือเปลี่ยนชื่อ Key ได้ที่ตัวแปร `VALUE_FIELDS` ด้านบนของไฟล์ `src/Code.js`

## โครงสร้างโปรเจกต์
- `src/Code.js` — โค้ด Google Apps Script (`doGet` / `doPost`, ตรวจ API Key, Validate ตัวเลข, `LockService`)
- `src/appsscript.json` — ตั้งค่าโปรเจกต์ Apps Script (`Asia/Bangkok`, `V8`)

## วิธีใช้งาน
1. สร้าง Google Sheets ใหม่ (หรือ Copy ไฟล์ตัวอย่างจากในคลิป)
2. เปิดเมนู **Extensions > Apps Script** แล้วนำโค้ดจาก `src/Code.js` ไปวาง
3. แก้ไขรหัสผ่าน `#1` (`FALLBACK_API_KEY`) ในไฟล์ หรือตั้งค่า `API_KEY` ใน **Project Settings > Script Properties**
4. กด **Deploy > New deployment > Web app**
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
5. นำ Web App URL (`/exec`) ที่ได้ไปทดสอบยิงข้อมูล:

### ตัวอย่าง HTTP GET (Query String)
```text
<WEB_APP_URL>?key=CHANGE_ME_SECRET_KEY&device=server01&val1=45.2&val2=62.5&note=ok
```

### ตัวอย่าง HTTP POST (JSON)
```json
{
  "key": "CHANGE_ME_SECRET_KEY",
  "device": "shelly_gen3",
  "val1": 28.4,
  "val2": 61.0,
  "note": "room1"
}
```

## ข้อควรระวัง
- ทุกครั้งที่แก้ไขโค้ด ต้องกด **Deploy > Manage deployments > แก้ไข > New version > Deploy** เสมอ
- ไม่ควรส่งข้อมูลถี่เกินไป (แนะนำ **10 วินาทีขึ้นไปต่อครั้ง**) เพื่อป้องกัน Request ชนกันและเกิน Quota ของ Google
