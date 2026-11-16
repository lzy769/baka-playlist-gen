/**
 * 播放解析 Provider（可插拔多源）
 *
 * 生成出的 BakaMusic 插件在播放时需要把"QQ mid"解析成真实可播 URL。
 * 由于单一第三方源可能失效 / 限流 / 被清，这里提供【多源按序回退】：
 *   - 依次尝试每个 provider，拿到可用 URL 即返回；
 *   - 全部失败才返回 null（由播放端决定是否提示失败）。
 *
 * 使用方（plugin-gen.mjs）把本文件的内容内嵌进生成的插件，
 * 或按需裁剪。默认提供 QQ 聚合源（cihedai），可自行追加/替换。
 */

/** 默认 QQ 聚合音源解析器（对应 `tang.api.s01s.cn` 社区接口）。 */
export function makeQQAggregateProvider({ base = "https://tang.api.s01s.cn/music_open_api.php", key = "" } = {}) {
  const FIELDS = {
    "128k": "song_play_url_standard",
    "320k": "song_play_url_hq",
    "flac": "song_play_url_sq",
  };
  return {
    name: "qq-aggregate",
    async resolve(musicItem, quality) {
      const mid = String(musicItem.mid || musicItem.songmid || musicItem.id || "");
      if (!mid) return null;
      const field = FIELDS[quality] || FIELDS["128k"];
      const params = new URLSearchParams({ mid });
      if (key) params.set("key", key);
      const url = `${base}?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      let u = json && json[field];
      if (typeof u !== "string" || !/^https?:\/\/\S+$/i.test(u.trim())) {
        // 降级：任意可用音质
        for (const q of ["128k", "320k", "flac"]) {
          const f = FIELDS[q];
          const v = json && json[f];
          if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) { u = v.trim(); break; }
        }
      }
      return u && u.trim().startsWith("http") ? { url: u.trim(), quality } : null;
    },
  };
}

/**
 * 播放解析池：按序尝试多个 provider。
 * @param {Array<object>} providers
 */
export function makeProviderPool(providers) {
  return {
    providers,
    async resolve(musicItem, quality) {
      for (const p of providers) {
        try {
          const r = await p.resolve(musicItem, quality);
          if (r && r.url) return { ...r, provider: p.name };
        } catch {
          // 单个 provider 失败则继续下一个
        }
      }
      return null;
    },
  };
}

/**
 * 生成供插件内嵌的播放解析函数源码（CommonJS 兼容）。
 * 默认池：QQ 聚合源（可按需扩展）。
 */
export function renderPlayerSourceCode() {
  return `
// ---- 播放解析（多源按序回退） ----
const PROVIDERS = [
  {
    name: "qq-aggregate",
    async resolve(musicItem, quality) {
      const mid = String(musicItem.mid || musicItem.songmid || musicItem.id || "");
      if (!mid) return null;
      const FIELDS = { "128k": "song_play_url_standard", "320k": "song_play_url_hq", "flac": "song_play_url_sq" };
      const field = FIELDS[quality] || FIELDS["128k"];
      const res = await axios.get("https://tang.api.s01s.cn/music_open_api.php", { params: { mid }, timeout: 10000 });
      const json = res.data;
      let u = json && json[field];
      if (typeof u !== "string" || !/^https?:\\/\\/\\S+$/i.test(u.trim())) {
        for (const q of ["128k", "320k", "flac"]) {
          const v = json && json[FIELDS[q]];
          if (typeof v === "string" && /^https?:\\/\\//i.test(v.trim())) { u = v.trim(); break; }
        }
      }
      return u && u.trim().startsWith("http") ? { url: u.trim(), quality } : null;
    },
  },
];

async function resolvePlayerSource(musicItem, quality) {
  for (const p of PROVIDERS) {
    try {
      const r = await p.resolve(musicItem, quality);
      if (r && r.url) return { ...r, provider: p.name };
    } catch (_) { /* 继续下一个 */ }
  }
  return null;
}
// -----------------------------------
`;
}