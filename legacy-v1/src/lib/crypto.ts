import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Master key được lưu trong data/.master.key (chmod 600). Tự sinh nếu chưa có.
// Trong production, nên đặt key qua biến môi trường FBM_MASTER_KEY (base64) thay vì file.

const dataDir = path.join(process.cwd(), "data");
const keyPath = path.join(dataDir, ".master.key");

function loadOrCreateKey(): Buffer {
  const fromEnv = process.env.FBM_MASTER_KEY;
  if (fromEnv) {
    const buf = Buffer.from(fromEnv, "base64");
    if (buf.length !== 32) throw new Error("FBM_MASTER_KEY phải dài 32 byte (base64).");
    return buf;
  }
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(keyPath)) {
    const buf = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "base64");
    if (buf.length === 32) return buf;
  }
  const fresh = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, fresh.toString("base64"), { mode: 0o600 });
  return fresh;
}

let _key: Buffer | null = null;
function key(): Buffer {
  if (!_key) _key = loadOrCreateKey();
  return _key;
}

// Định dạng output: "v1:<iv_b64>:<tag_b64>:<cipher_b64>"
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(packed: string): string {
  if (!packed.startsWith("v1:")) {
    // Backward-compat: chuỗi không mã hoá → trả nguyên (cho phép migrate dần)
    return packed;
  }
  const [, ivB64, tagB64, encB64] = packed.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function isEncrypted(s: string): boolean {
  return s.startsWith("v1:");
}
