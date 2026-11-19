# 🎵 baka-playlist-gen

![GitHub release](https://img.shields.io/github/v/release/lzy769/baka-playlist-gen?label=release)
![License](https://img.shields.io/github/license/lzy769/baka-playlist-gen)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933)
![GitHub stars](https://img.shields.io/github/stars/lzy769/baka-playlist-gen?style=social)

把任意 **Excel / CSV 歌曲列表** 一键转换成 **BakaMusic 语言分组歌单插件** 的命令行工具。

> 你有一张几百上千首的歌单（`.xlsx` / `.csv`），想直接在 [BakaMusic](https://github.com/Zencok/BakaMusic) 里按「中文 / 日文 / 英文」分类点开就播？这个工具帮你完成：解析列表 → 匹配歌曲 → 语言分组 → 生成插件 → 复制进 BakaMusic。

---

## ✨ 特性

- **输入灵活**：支持 `.csv`（零依赖）与 `.xlsx`
- **自动语言分组**：中文 / 日文 / 英文 / 韩文 / 其他，可通过 `--langs` 自定义启用
- **严格歌曲匹配**：搜索 QQ 音乐并**二次校验 mid 对应的真实歌名/歌手**，杜绝「歌名和歌曲不对版」
- **多源播放回退**：生成的插件播放走**多源按序回退**（单个解析源失效自动换源），更稳
- **自动匹配封面与歌词**：播放时自动从 QQ 拉取**封面(artwork)**和**歌词(LRC)**，歌单点开即有图有词
- **列表直接显示封面**：加 `--with-covers` 会在生成时批量预取封面写进插件，**歌单列表不点进去就能看到专辑图**（实测覆盖率约 97%）
- **可断点续跑**：大批量匹配中断后，用 `--resume` 从上次进度继续
- **未匹配报告**：匹配不上的歌会输出 `unmatched.txt`，方便手动补齐
- **完整插件生成**：每个语言生成一个 BakaMusic 插件，放进插件目录即可在「推荐歌单」里点开播放
- **可并发 / 可调速**：`--concurrency` / `--interval` 控制匹配速度，避免限流
- **零运行时依赖**：核心逻辑只用 Node 内置模块（读 `.xlsx` 需可选装 `xlsx` 包，或用 CSV）

## 📦 安装

需要 **Node.js ≥ 18**。

```bash
git clone https://github.com/<your-name>/baka-playlist-gen.git
cd baka-playlist-gen
npm install          # 可选：若解析 .xlsx，运行 npm i xlsx
```

## 🚀 快速开始

准备一个 `songlist.csv`（第一列歌名，第二列歌手）：

```csv
夜的第七章,周杰伦
晴るる,ヨルシカ
Numb,Linkin Park
Dynamite,BTS
搁浅,周杰伦
アイロニ,4円
Shape of You,Ed Sheeran
```

运行：

```bash
node src/cli.mjs songlist.csv --out dist
```

输出到 `dist/`：

```
dist/
├── local-playlist-中文.js    # 中文歌单
├── local-playlist-日文.js    # 日文歌单
├── local-playlist-英文.js    # 英文歌单
└── local-playlist-韩文.js    # 韩文歌单（如有）
```

### 装进 BakaMusic

1. 打开 BakaMusic 的数据目录，进入 `bakamusic-plugins` 文件夹
   （Windows 一般是 `%APPDATA%\BakaMusic\bakamusic-plugins`）
2. 把生成出的 `.js` 插件复制进去
3. 重启 BakaMusic
4. 打开左侧栏「**推荐歌单**」，即可看到「中文歌单 / 日文歌单 / …」，点开即播

> 也可在 BakaMusic「插件管理」里导入生成的插件文件（本地导入）。

## ⚙️ CLI 参数

```
node src/cli.mjs <input.csv|xlsx> [options]

  input              必填，歌曲列表文件（.csv 或 .xlsx）
  --langs <a,b,c>    启用的语言分组，默认 中文,日文,英文,韩文,其他
  --out <dir>        输出目录，默认 ./dist
  --concurrency <n>  QQ 匹配并发数，默认 3（调高更快，但易触发限流）
  --interval <ms>    每次匹配间隔毫秒，默认 120
  --sheet-prefix <s> 歌单标题前缀
  --resume <f>       从上次保存的匹配状态断点续跑
  --save-state <f>   把匹配状态保存到 JSON（配合 --resume）
  --delimiter <c>    指定 CSV 分隔符（默认自动：制表符 > 逗号）
  --start-row <n>    从第 n 行开始解析（0-based）
  --no-header        不自动跳过表头行
  --with-covers      预取封面写入插件（列表不点进去就显示专辑图）
  --cover <文件|URL>  自定义歌单封面（推荐歌单卡片显示），可多次使用：
                       --cover 中文=./imgs/zh.png   仅该语言
                       --cover ./cover.png          应用到所有歌单
                      本地图片自动转 data:URL 内嵌，也可直接填图片 URL
                      （不指定则自动取歌单里第一首有封面的歌）
  --just-group       仅语言分组（不联网匹配）
  -h, --help         帮助
```

### 示例

```bash
# 只要中/英/日三组，并发 5
node src/cli.mjs list.csv --langs 中文,英文,日文 --concurrency 5

# 解析 xlsx（需先 npm i xlsx）
node src/cli.mjs "我的歌单.xlsx" --out mydist

# 仅做语言分组，不匹配 mid
node src/cli.mjs list.csv --just-group

# 断点续跑：先存状态，中断后从上次进度继续
node src/cli.mjs list.csv --save-state state.json
node src/cli.mjs list.csv --resume state.json

# 自定义 CSV：制表符分隔、从第 3 行开始
node src/cli.mjs list.tsv --delimiter "	" --start-row 2

# 自定义歌单封面：所有歌单用同一张图（本地图片自动内嵌为 data URL）
node src/cli.mjs list.csv --cover ./imgs/my-music.png

# 按语言分别设置封面
node src/cli.mjs list.csv --cover 中文=./imgs/zh.png --cover 日文=./imgs/jp.jpg --cover 英文=https://example.com/en.png
```

## 🔧 工作原理

见 [docs/how-it-works.md](docs/how-it-works.md)。

核心流程：

1. **解析**：读 `.csv` / `.xlsx` → `[{ title, artist }]`
2. **匹配**：用 QQ 带签名搜索接口按「歌名 + 歌手」搜候选；再调 `CgiGetTrackInfo` 按 mid 查真实歌名/歌手，**两端都匹配才采纳**，否则标记为未匹配（绝不硬配）
3. **分组**：按标题/歌手特征判断语言（含日文歌手名单辅助判别）
4. **生成**：每个语言渲染一个单文件插件，内嵌歌曲 mid 数据

### 项目结构

```
baka-playlist-gen/
├── .github/workflows/ci.yml  # CI 自动测试
├── src/
│   ├── cli.mjs             # 命令行入口
│   ├── excel-parser.mjs    # CSV / XLSX 解析
│   ├── matcher.mjs         # QQ 搜索 + mid 严格校验
│   ├── language-detect.mjs # 语言分组（可配置）
│   ├── player-provider.mjs # 播放多源回退（设计参考）
│   └── plugin-gen.mjs      # BakaMusic 插件生成
├── templates/             # 插件模板说明
├── examples/              # 示例歌单
├── docs/
│   └── how-it-works.md    # 原理详解
└── package.json
```

## ⚠️ 版权与合规声明

- 本工具只负责「歌曲列表 → 歌单数据」的格式转换，**不存储、不传播任何音频内容**。
- 生成的歌单仅以歌曲 **元数据（歌名/歌手/mid）** 存在，播放依赖你已安装的 BakaMusic 音源插件。
- 默认的播放解析走第三方接口，**可能失效、被限流，且涉及版权合规风险**。请在 README 与
  [docs/how-it-works.md](docs/how-it-works.md) 明示此点，并在正式分发前自行评估是否替换该解析逻辑。
- 请只把本工具用于你有权使用的歌曲列表，尊重版权、支持正版。

## 🤝 贡献

欢迎提交 Issue / PR。请确保：

- 新增功能附带测试（`npm test`）
- 保持零运行时依赖（CSV 路径）或仅在说明中可选引入
- 不引入固定歌曲数据

## 🛠️ 开发与维护

### 模块职责
| 文件 | 职责 |
|---|---|
| `src/cli.mjs` | 命令行入口，串联 解析→匹配→分组→生成 |
| `src/excel-parser.mjs` | CSV / XLSX 解析（含编码、分隔符、表头、起始行） |
| `src/matcher.mjs` | QQ 搜索 + mid 严格二次校验（杜绝"歌名≠歌曲"错配） |
| `src/language-detect.mjs` | 语言分组（中/日/英/韩/其他，可配置） |
| `src/player-provider.mjs` | 播放多源回退设计（供插件内嵌） |
| `src/plugin-gen.mjs` | 生成 BakaMusic 插件（含封面/歌词动态获取） |

### 常用命令
```bash
npm test          # 运行单元测试
node src/cli.mjs list.csv --out dist   # 完整流程
node scripts/regen-from-matches.mjs matches.json dist  # 从已匹配数据重建插件
```

### 关于封面与歌词

封面有两条路径，可以同时生效：

1. **列表显示（离线嵌入）**：加 `--with-covers` 后，生成阶段会调 `prefetchCovers()`
   批量查询每首歌的专辑封面 URL，写进插件内嵌的 `SONGS` 数据里（`artwork` / `album` 字段）。
   这样**不点进歌单也能看到专辑图**。批量查一次 100 首，约 97% 的歌能取到封面。
2. **播放时兜底（动态获取）**：`getMusicInfo` 会在播放时按 mid 再查一次 QQ，
   补充真实歌名/歌手/专辑/封面，覆盖预取时漏掉的歌。

歌词走 `getLyric`，**优先取带翻译的歌词**：

- **主路径**：QQ 新接口 `music.musichallSong.PlayLyricInfo`（`GetPlayLyricInfo`，
  `crypt=0`），同一次请求同时返回原文 `lyric` 与翻译 `trans`（base64 明文 LRC）。
  日文/英文歌单因此能在播放器里显示中文翻译。
- **兜底**：新接口失败时回退 legacy 接口 `fcg_query_lyric_new.fcg`（去 JSONP + base64 解码），
  保证原文歌词仍然可用。
- 翻译流会去掉 `[kana:...]` 等元信息；未翻译的 `//` 行保留时间轴、清空文本。

> 注意：中文歌在 QQ 侧本身没有翻译数据，开启翻译也只会显示原文，这是数据源限制。

> 批量查询注意：`CgiGetTrackInfo` 的 `types` 数组长度必须与 `mids` 一致，
> 否则接口返回空数组（这是踩过的坑）。

如需更换歌词/封面来源，修改 `src/plugin-gen.mjs` 中 `prefetchCovers` / `getLyric` 即可。

## 📄 License

[MIT](LICENSE)