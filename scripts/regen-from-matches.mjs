#!/usr/bin/env node
/**
 * 从已校验的匹配结果(rematch 格式的 JSON)重新生成语言歌单插件。
 *
 * 用途：当你已经做过一次匹配(得到 {i,n,a,mid,verified,...} 数组)，
 * 想重新生成插件（例如工具升级后）时，不必重新联网匹配。
 *
 * 用法：
 *   node scripts/regen-from-matches.mjs <matches.json> <outDir> [--langs 中文,英文]
 *   node scripts/regen-from-matches.mjs rematch_results.json dist
 */
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { groupByLanguage, LANGS } from "../src/language-detect.mjs";
import { generatePlugins, prefetchCovers, attachCovers } from "../src/plugin-gen.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function usage() {
  console.log(`用法: node scripts/regen-from-matches.mjs <matches.json> <outDir> [--langs 中文,英文,...]

  <matches.json>  匹配结果文件，含数组 [{ i,n,a,mid,verified,realName,... }]
  <outDir>        输出目录（生成的插件写入这里）
  --langs <a,b>   可选的启用语言分组，默认全部
  --with-covers   预取封面写入插件（列表不点进去就显示专辑图）
`);
}

async function main() {
  const argv = process.argv.slice(2);
  let input = null, out = null, langs = null, withCovers = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--langs") { langs = (argv[i + 1] || "").split(",").map((s) => s.trim()).filter(Boolean); i += 1; }
    else if (a === "--with-covers") { withCovers = true; }
    else if (a === "--help" || a === "-h") { usage(); process.exit(0); }
    else if (!input) input = a;
    else if (!out) out = a;
  }
  if (!input || !out) { usage(); process.exit(1); }

  // 读匹配结果
  const res = JSON.parse(readFileSync(path.resolve(input), "utf-8"));
  const songs = (Array.isArray(res) ? res : (res.results || []))
    .filter((r) => r && r.verified && r.mid)
    .map((r) => ({ title: r.n || r.title, artist: r.a || r.artist, mid: r.mid }));
  console.log(`读取 ${songs.length} 条已验证歌曲`);

  // 语言分组（自动去重）
  const groups = groupByLanguage(songs, langs || undefined);
  console.log("分组:", Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])));

  // 可选：预取封面写进插件（列表不点进去也能显示专辑图）
  let finalGroups = groups;
  if (withCovers) {
    const allMids = Object.values(groups).flat().map((s) => s.mid).filter(Boolean);
    console.log(`预取封面（${allMids.length} 首）...`);
    const covers = await prefetchCovers(allMids, {
      onProgress: ({ done, total }) => process.stdout.write(`\r  封面 ${done}/${total}`),
    });
    process.stdout.write("\n");
    console.log(`  拿到 ${covers.size} 张封面`);
    finalGroups = attachCovers(groups, covers);
  }

  // 生成插件
  mkdirSync(out, { recursive: true });
  const sheetTitleFor = (lang, count) => `${lang}歌单${count}首`;
  const files = generatePlugins(finalGroups, { outDir: path.resolve(out), sheetTitleFor });

  console.log(`\n✅ 已生成 ${files.length} 个插件到 ${path.resolve(out)}:`);
  files.forEach((f) => console.log(`   - ${path.basename(f)}`));
  console.log("\n把 .js 复制到 BakaMusic 的 bakamusic-plugins 目录并重启即可生效。");
}

main().catch((e) => { console.error("出错:", e.message); process.exit(1); });