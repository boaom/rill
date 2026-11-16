// server/crypto.mjs —— 会话 cookie 的 AES-256-GCM 加密与不透明 ID。
// 只依赖 node:crypto；密钥只来自 RILL_SECRET，不落库、不写日志。
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * 解析 32 字节密钥：优先 64 位 hex，其次 base64。
 * 失败信息里只给生成命令，绝不回显密钥内容。
 */
export function loadSecret(raw = process.env.RILL_SECRET) {
  if (!raw || !String(raw).trim()) {
    throw new Error(
      'RILL_SECRET 未设置：需要 32 字节密钥（base64 或 hex）。生成命令：' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const text = String(raw).trim();
  let key;
  if (/^[0-9a-f]{64}$/i.test(text)) {
    key = Buffer.from(text, 'hex');
  } else {
    key = Buffer.from(text, 'base64');
  }
  if (key.length !== 32) {
    throw new Error(
      'RILL_SECRET 无效：解码后必须恰好 32 字节（base64 或 hex）。生成命令：' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  return key;
}

export function encryptJson(key, value) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    encrypted,
    iv,
    tag: cipher.getAuthTag(),
  };
}

export function decryptJson(key, { encrypted, iv, tag }) {
  if (!encrypted || !iv || !tag || tag.length !== TAG_BYTES) {
    throw new Error('会话数据损坏');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

/** 浏览器 cookie 的不透明会话 ID（43 字符 base64url，无填充）。 */
export function newSid() {
  return randomBytes(32).toString('base64url');
}

/** 与会话绑定的 CSRF token；存 kv，GET /api/session 可读。 */
export function newCsrfToken() {
  return randomBytes(24).toString('base64url');
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}