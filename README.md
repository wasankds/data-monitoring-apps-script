# data-monitoring-apps-script

ระบบบันทึกข้อมูล Monitoring เข้า Google Sheets ฟรี ด้วย Google Apps Script (รองรับทั้ง `HTTP GET` และ `HTTP POST JSON`)

## จุดเด่น: ยืดหยุ่นตามหัวตาราง Google Sheets
ไม่ต้องแก้โค้ดเวลาเพิ่ม/ลดคอลัมน์! แค่ตั้งชื่อหัวตารางใน **แถวที่ 1** ของแท็บ `Log` เช่น:
`Timestamp` | `Request Type` | `Temp` | `Hum` | `Note`

* `Timestamp` (หรือ `เวลา`) — ระบบกรอกเวลาปัจจุบันให้อัตโนมัติ
* `Request Type` — ระบบกรอก `GET` หรือ `POST` ให้อัตโนมัติ
* `Note` (ถ้ามี) — รับข้อความ (ป้องกัน Formula Injection)
* **คอลัมน์อื่นๆ ที่คุณตั้งชื่อเอง** (เช่น `Temp`, `Hum`, `CPU`, `RAM`, `Val1`, `Val2`) — ระบบจะจับคู่จาก Key ที่ส่งเข้ามา (ไม่สนตัวพิมพ์เล็ก/ใหญ่) และ **Validate ว่าเป็นตัวเลขเท่านั้น**

## วิธีใช้งาน
1. สร้างแท็บชื่อ `Log` ใน Google Sheets และพิมพ์หัวตารางในแถวที่ 1 ตามต้องการ
2. เปิดเมนู **Extensions > Apps Script** แล้วนำโค้ดจาก `src/Code.js` ไปวาง
3. แก้ไขรหัสผ่าน `#1` (`FALLBACK_API_KEY`) ในไฟล์ (หรือตั้งค่า `API_KEY` ใน **Project Settings > Script Properties**)
4. กด **Deploy > New deployment > Web app** (`Execute as: Me`, `Who has access: Anyone`)
5. ส่งข้อมูลให้ชื่อ Key ตรงกับหัวตารางในแถวที่ 1:

### ตัวอย่าง HTTP GET (Query String)
```text
<WEB_APP_URL>?key=CHANGE_ME_SECRET_KEY&Temp=28.5&Hum=60.2&Note=ok
```

### ตัวอย่าง HTTP POST (JSON)
```json
{
  "key": "CHANGE_ME_SECRET_KEY",
  "Temp": 28.5,
  "Hum": 60.2,
  "Note": "room1"
}
```

## ข้อควรระวัง
- หากแก้โค้ดใน Apps Script ต้องกด **Deploy > Manage deployments > แก้ไข > New version > Deploy** เสมอ
- ไม่ควรส่งข้อมูลถี่เกินไป (แนะนำ **10 วินาทีขึ้นไปต่อครั้ง**) เพื่อป้องกัน Request ชนกันและเกิน Quota ของ Google
