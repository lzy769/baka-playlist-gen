# 🎵 baka-playlist-gen

把任意 **Excel / CSV 歌曲列表** 一键转换成 **BakaMusic 语言分组歌单插件** 的命令行工具。

> 你有一张几百上千首的歌单（`.xlsx` / `.csv`），想直接在 [BakaMusic](https://github.com/Zencok/BakaMusic) 里按「中文 / 日文 / 英文」分类点开就播？这个工具帮你完成：解析列表 → 匹配歌曲 → 语言分组 → 生成插件 → 复制进 BakaMusic。

---

## ✨ 特性

- **输入灵活**：支持 `.csv`（零依赖）与 `.xlsx`
- **自动语言分组**：中文 / 日文 / 英文 / 韩文 / 其他，可通过 `--langs` 自定义启用
- **严格歌曲匹配**：搜索 QQ 音乐并**二次校验 mid 对应的真实歌名/歌手**，杜绝「歌名和歌曲不对版」
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
├── src/
│   ├── cli.js             # 命令行入口
│   ├── excel-parser.js    # CSV / XLSX 解析
│   ├── matcher.js         # QQ 搜索 + mid 严格校验
│   ├── language-detect.js # 语言分组（可配置）
│   └── plugin-gen.js      # BakaMusic 插件生成
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

## 📄 License

[MIT](LICENSE)