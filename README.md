# Songloft Plugin: Go Music DL

一个把 [go-music-dl](https://github.com/guohuiyuan/go-music-dl) 接入 Songloft 的音源插件。
它让 Songloft 直接通过本地或远程的 go-music-dl 实例聚合搜索网易云、QQ、酷狗、酷我、咪咕、Bilibili 等音源，并支持试听、歌词与导入本地库。



## 配置

在插件设置页填写：

- **go-music-dl 实例地址**：例如 `http://192.168.1.1:8080/music`（默认端口8080）。
- **搜索音源**：勾选需要参与搜索的平台。

### MIoT 口令联动（可选）

本插件已内置 `/api/search/topone` 端点，兼容 MIoT 智能音箱插件的 `OnlineSearcher` 契约。

插件在 `onInit` 时会通过插件间通信（`songloft.comm`）**自动把自身注册为 MIoT 的「外部搜索源候选」**（显示名 `GoMusicDL`）。在 miot 配置页即可一键选用，无需手写 URL。

**推荐方式（自动注册）：**

1. 确保已安装 go-music-dl 插件（含 `inter-plugin` 权限）与 MIoT 插件，并均已启用。
2. 进入 MIoT 插件设置 →「外部搜索」区域。
3. 在搜索源下拉中选中 **`GoMusicDL`** 即可（插件启动时已自动注入，未出现可重启一次插件）。
4. 启用该源，并打开「外部搜索」总开关。
5. 搜索优先级 `search_priority` 设为 `external_first`（口令优先走 go-music-dl）或 `parallel`。

**备选方式（手动添加）：**

若你的宿主版本较旧、不支持插件间通信，可在 MIoT 设置页手动新增一个源：

- **名称**：`go-music-dl`
- **URL**：`/api/v1/jsplugin/go-music-dl/api/search/topone`

**确认前提：**
- MIoT 的 `server_host` 必须填写**局域网 IP**（否则音箱无法拉取宿主流）。
- go-music-dl 插件已安装且已启用。

之后对小爱说「播放 XXX」即会经 go-music-dl 搜索歌曲并通过音箱出声。

### 「不入库直接播放」与桥接插件（重要）

MIoT 的 `external_search_no_import` 开关开启后，会把 `topone` 返回的 `url` 原样直推给音箱播放。
该 `url` 由本插件的 `makeBridgeUrl` 生成，**是否可用取决于是否安装了桥接插件（songloft-plugin-bridge）**：

- **已安装桥接插件**：`topone` 返回桥接插件的 LAN 直链（`http://<Bridge LAN>:<端口>/.../stream/go-music-dl/<token>`）。
  音箱连桥接插件再回源到 go-music-dl，无论 MIoT 与音源是否同网段都能播放。
  此时开启 `external_search_no_import` 即走「不入库直推」。
- **未安装桥接插件**：`makeBridgeUrl` 不再回退为 go-music-dl 自有直链，而是让 `url` 置空。
  MIoT 的「直链型」判定失败，**无论 `external_search_no_import` 开关开/关，都会回退到「入库播放」**
  （走 `source_data` + 宿主 `/api/music/url` 服务端回源，音箱连的是 Songloft 自身可达地址，必能出声）。

> 一句话：**没装桥接插件 → 一律入库播放（保证出声）；装了桥接插件 → 不入库直推才可生效。**
> 这样可避免「开关开着、却因缺少桥接插件而直推无声」的问题。

**桥接插件相关配置（如已安装）：**
- 桥接插件需启用，并保证其 `server_host` 为局域网 IP，使音箱可直连。
- 桥接缺失时无需任何额外操作，本插件自动降级为入库播放。

