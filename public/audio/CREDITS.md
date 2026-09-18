# 音频素材来源与授权

选自 `materials/audio/`（2026-09-17 下载，来源页快照与 SHA-256 见 `materials/audio/originals-manifest.json`、`verification.json`）。这里只放实际接入游戏的文件；WAV/MP3 原件用 macOS `afconvert` 转成 AAC（96 kbps，.m4a）以控制体积，其余原样复制、只改文件名。

| 文件 | 用途 | 作者 / 来源 | 许可 | 处理 |
| --- | --- | --- | --- | --- |
| a-kind-of-hope.m4a | 标题页音乐 | Scott Buckley — https://www.scottbuckley.com.au/library/a-kind-of-hope/ | CC BY 4.0（需署名） | MP3 转 AAC 96k，未裁切 |
| lofi-again.ogg | 白天排程音乐 | omfgdude — https://opengameart.org/content/lofi-again | CC0 | 原样 |
| a-small-fire-will-do.m4a | 营地夜晚音乐 | Trex0n / Cal McEachern — https://opengameart.org/content/a-small-fire-will-do-calming-loop | CC0 | WAV 转 AAC 96k |
| fireplace-loop.m4a | 篝火环境声 | PagDev — https://opengameart.org/content/fireplace-sound-loop | CC0 | WAV 转 AAC 96k |
| rain-short.ogg | 雨天环境声 | Ove Melaa — https://opengameart.org/content/rain-ambient-not-loopable-2-versions-available | CC0 | 原样（作者标注非无缝循环，接缝用 1 秒淡入淡出掩盖） |
| wind-whoosh-loop.ogg | 寒潮/候车室风声 | SketchMan3 — https://opengameart.org/content/wind-whoosh-loop | CC0 | 原样 |
| radio-static.mp3 | 收音机杂音 | xhunterko — https://opengameart.org/content/static | CC0 | 原样 |
| ui-click / ui-confirm / ui-back / ui-open / ui-close .ogg | 界面音 | Kenney Interface Sounds — https://kenney.nl/assets/interface-sounds | CC0 | 原样改名（click_001 / confirmation_001 / back_001 / open_001 / close_001） |
| card-flip / card-shuffle / chips / chip-lay .ogg | 牌局音 | Kenney Casino Audio — https://kenney.nl/assets/casino-audio | CC0 | 原样改名（card-slide-1 / card-shuffle / chips-handle-1 / chip-lay-1） |
| coins / footstep / cloth .ogg | 零钱、脚步、衣物 | Kenney RPG Audio — https://kenney.nl/assets/rpg-audio | CC0 | 原样改名（handleCoins / footstep00 / cloth1） |

署名（按作者要求，游戏鸣谢页与宣传视频简介都要放）：

> "A Kind Of Hope" by Scott Buckley — released under CC-BY 4.0. www.scottbuckley.com.au

作者另要求：不单独转售、不上传到音乐流媒体平台、不提交 Content ID 等音频指纹服务（https://www.scottbuckley.com.au/library/using-this-music/）。

没有文件的声音（街道底噪、电视嗡声、行李箱轮子、开机声等）由 `public/ui/audio.js` 用 WebAudio 现场合成，不涉及第三方素材。

## 新增玩法短音（原样复制，未转码）

以下20个文件来自 Kenney 原包，均为 CC0；作者、作品页和授权证据见原项目 `materials/audio/packs/<包名>/SOURCE.md`，对应官方页分别为 https://kenney.nl/assets/rpg-audio 、https://kenney.nl/assets/casino-audio 、https://kenney.nl/assets/interface-sounds 。这里记录复制后的 SHA-256，可与原包逐字节核对。素材未人工试听。

| 游戏文件 | 原包路径（相对 `materials/audio/packs/`） | SHA-256 |
| --- | --- | --- |
| `fish-bite.ogg` | `kenney-interface-sounds/original/Audio/pluck_001.ogg` | `be97ec4893a02d6eccfb678daa76c83e34cb2583b834ec2593d2641def739fa4` |
| `reel.ogg` | `kenney-interface-sounds/original/Audio/scratch_001.ogg` | `5c294d2e1a6b6d07ee2d75b17105a55ad3527e5482dd60652dc49c2ea4c70096` |
| `fish-catch.ogg` | `kenney-interface-sounds/original/Audio/confirmation_002.ogg` | `33b17a9a9a2397c62b285c52c33a907fdffb476909c99e42dde603f6a7a8b12c` |
| `fish-escape.ogg` | `kenney-interface-sounds/original/Audio/error_001.ogg` | `46e67425d16339772e8d328fb36a49426c9467418686e11beeb71ff84b0f6433` |
| `coffee-sip.ogg` | `kenney-interface-sounds/original/Audio/glass_001.ogg` | `183eebee20eb0a532b0b85104d139cbf2673eb66d95c3cc733ac9ea98362e7e8` |
| `meal.ogg` | `kenney-rpg-audio/original/Audio/metalPot1.ogg` | `159def979e8e386c2c539f5e99cc30a080eb2dcb6c911fa2e4ccc0785b2522fd` |
| `work-sort.ogg` | `kenney-rpg-audio/original/Audio/bookFlip1.ogg` | `fa81ac2fedc8c641661b87e349630a36c9800e795e0c800e029214efdbe26a7d` |
| `work-rotate.ogg` | `kenney-rpg-audio/original/Audio/metalClick.ogg` | `9851a69d0c613e13bceef08060ecc4148f098ef487927cbebe270d642398a3b3` |
| `work-camera.ogg` | `kenney-interface-sounds/original/Audio/click_002.ogg` | `adcd1f4adc35f1b41bc1b5bbefeff7aa44f2f3f0d96d3199b544140c7c1e761c` |
| `work-cut.ogg` | `kenney-rpg-audio/original/Audio/knifeSlice.ogg` | `4cd96dc630bed9840c15f1dd2306da2cc56a4da26a5d3f1a03c5a7265ac5e54f` |
| `work-handoff.ogg` | `kenney-rpg-audio/original/Audio/bookPlace1.ogg` | `26f3ce60fbde85b678b0ad7f6624d80535fe540d88232ad1e38e47a96662d977` |
| `work-success.ogg` | `kenney-interface-sounds/original/Audio/confirmation_002.ogg` | `33b17a9a9a2397c62b285c52c33a907fdffb476909c99e42dde603f6a7a8b12c` |
| `work-miss.ogg` | `kenney-interface-sounds/original/Audio/error_001.ogg` | `46e67425d16339772e8d328fb36a49426c9467418686e11beeb71ff84b0f6433` |
| `cups-shuffle.ogg` | `kenney-casino-audio/original/Audio/dice-shake-1.ogg` | `ba603441c857204dbe3ff3345902c7e1c3f523bf1bd314acf088609bc6c1e4e5` |
| `parcel-arrive.ogg` | `kenney-rpg-audio/original/Audio/dropLeather.ogg` | `097e1d3b74949b0145fda0519d40b7e0773ab82ec4858727f95be830927e1a45` |
| `parcel-open.ogg` | `kenney-rpg-audio/original/Audio/metalLatch.ogg` | `ba9ba60b172b3ebc131a940f25793cd2e207aca7af73dc80d637277f060f1708` |
| `furniture-place.ogg` | `kenney-rpg-audio/original/Audio/bookPlace1.ogg` | `26f3ce60fbde85b678b0ad7f6624d80535fe540d88232ad1e38e47a96662d977` |
| `furniture-move.ogg` | `kenney-rpg-audio/original/Audio/creak1.ogg` | `8a346186fd297254248cab8e8117060a52a5cf2a84f603153a762108550ea95e` |
| `sleep-ground.ogg` | `kenney-rpg-audio/original/Audio/cloth2.ogg` | `8a7451193c38bc05483aec25dd193e163a15d44cf7fff04ac7912573231b0201` |
| `sleep-bed.ogg` | `kenney-rpg-audio/original/Audio/creak1.ogg` | `8a346186fd297254248cab8e8117060a52a5cf2a84f603153a762108550ea95e` |

水花、游水、炭火点燃与烹煮的短反馈由 `public/ui/audio.js` 实时合成；这些不是下载音频，也未进行人工听感核验。
