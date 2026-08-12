// Preset avatar catalog cho Gameshow — MVP không cho upload ảnh, chỉ chọn từ
// danh sách emoji cố định (đủ để tạo cảm giác cá nhân hoá kiểu Wayground).
export const AVATARS: Record<string, string> = {
  fox: "🦊",
  cat: "🐱",
  dog: "🐶",
  panda: "🐼",
  koala: "🐨",
  lion: "🦁",
  tiger: "🐯",
  owl: "🦉",
  penguin: "🐧",
  frog: "🐸",
  unicorn: "🦄",
  dragon: "🐲",
  robot: "🤖",
  alien: "👽",
  ghost: "👻",
  ninja: "🥷",
};

export const AVATAR_KEYS = Object.keys(AVATARS);

export function isValidAvatarKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(AVATARS, key);
}

export function randomAvatarKey(): string {
  return AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)]!;
}
