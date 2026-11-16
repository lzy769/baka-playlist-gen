#!/usr/bin/env node
/**
 * baka-playlist-gen CLI
 *
 * 把 Excel / CSV 歌曲列表转换成 BakaMusic 语言分组歌单插件。
 *
 * 用法：
 *   node src/cli.js <input.csv|input.xlsx> [--langs 中文,日文,英文] [--out dist]
 *                                 [--concurrency 3] [--interval 120] [--just-group]
 *
 * 参数：
 *   input                 必填，歌曲列表文件（.csv 或 .xlsx）
 *   --langs <a,b,...>      启用的语言分组，默认 中文,日文,英文,韩文,其他
 *   --out <dir>            输出目录，默认 ./dist
 *   --concurrency <n>      QQ 匹配并发数，默认 3（调高更快，但易触发限流）
 *   --interval <ms>        每次匹配间的间隔，默认 120ms
 *   --sheet-prefix <s>     歌单标题前缀，默认按语言
 *   --just-group          只做语言分组，不联网匹配（需要 pre-matched 输入）
 *   --help / -h            显示帮助
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseSongList } from "./excel-parser.mjs";
import { matchSongs } from "./matcher.mjs";
import { groupByLanguage, LANGS } from "./language-detect.mjs";
import { generatePlugins } from "./plugin-gen.mjs";

function parseArgs(argv) {
  const args = { input: null, langs: null, out: "dist", concurrency: 3, interval: 120, justGroup: false, sheetPrefix: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { args.help = true; continue; }
    if (a === "--just-group") { args.justGroup = true; continue; }
    if (a === "--langs") { args.langs = (argv[i + 1] || "").split(",").map((s) => s.trim()).filter(Boolean); i += 1; continue; }
    if (a === "--out") { args.out = argv[i + 1]; i += 1; continue; }
    if (a === "--concurrency") { args.concurrency = parseInt(argv[i + 1], 10) || 3; i += 1; continue; }
    if (a === "--interval") { args.interval = parseInt(argv[i + 1], 10) || 120; i += 1; continue; }
    if (a === "--sheet-prefix") { args.sheetPrefix = argv[i + 1]; i += 1; continue; }
    if (!a.startsWith("-") && !args.input) args.input = a;
  }
  return args;
}

function printHelp() {
  console.log(`baka-playlist-gen - 把歌曲列表转成 BakaMusic 语言分组歌单

用法:
  node src/cli.js <input.csv|xlsx> [options]

选项:
  --langs <a,b,c>       启用语言分组(默认 all): ${LANGS.join(",")}
  --out <dir>           输出目录(默认 ./dist)
  --concurrency <n>     QQ匹配并发(默认 3)
  --interval <ms>       匹配间隔毫秒(默认 120)
  --just-group          仅语言分组(不联网)
  -h, --help            帮助
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  console.log(`📖 读取: ${args.input}`);
  const songs = await parseSongList(args.input);
  console.log(`   ✓ 解析到 ${songs.length} 首歌曲`);

  // 1) 匹配 mid (除非 --just-group)
  let matched;
  if (args.justGroup) {
    matched = songs.map((s) => ({ title: s.title, artist: s.artist, mid: null, verified: false }));
  } else {
    console.log(`🔍 匹配 QQ mid（并发 ${args.concurrency}，间隔 ${args.interval}ms）...`);
    matched = await matchSongs(songs, {
      concurrency: args.concurrency,
      intervalMs: args.interval,
      onProgress: ({ done, total, verified }) => {
        process.stdout.write(`\r   进度 ${done}/${total}，已匹配 ${verified}`);
      },
    });
    process.stdout.write("\n");
    const ok = matched.filter((m) => m.verified).length;
    console.log(`   ✓ 匹配成功 ${ok}/${matched.length}`);
  }

  // 2) 语言分组
  const withMid = matched.filter((m) => m.verified || args.justGroup);
  const groups = groupByLanguage(
    withMid.map((m) => ({ title: m.title, artist: m.artist, mid: m.mid })),
    args.langs || undefined,
  );

  for (const [lang, list] of Object.entries(groups)) {
    if (list && list.length) console.log(` 🗂  ${lang}: ${list.length} 首`);
  }

  // 3) 生成插件
  mkdirSync(args.out, { recursive: true });
  const sheetTitleFor = (lang, count) =>
    args.sheetPrefix ? `${args.sheetPrefix}${lang}${count}首` : `${lang}歌单${count}首`;
  const files = generatePlugins(groups, { outDir: args.out, sheetTitleFor });

  if (files.length) {
    console.log(`\n✅ 已生成 ${files.length} 个歌单插件，输出到: ${args.out}`);
    files.forEach((f) => console.log(`   - ${path.basename(f)}`));
    console.log(`\n安装: 把插件文件复制到 BakaMusic 的 bakamusic-plugins 目录，重启即可。`);
  } else {
    console.log("\n⚠️ 没有可生成的歌单（所有分组为空）。");
  }
}

main().catch((e) => {
  console.error("\n❌ 出错:", e.message);
  process.exit(1);
});