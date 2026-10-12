# 本地高准确率英文字幕

双击 `start.cmd`，选择影片，点击“生成字幕”。默认使用 faster-whisper / large-v3，固定英文转写，不使用付费 API。

## 环境和模型

此电脑 MX550 只有 2GB 显存，因此默认 CPU INT8。INT8 节约内存，量化可能改变识别结果；可选 float32，使用更多内存且更慢，不保证每个样本更准确。首次下载 large-v3 需要网络和几 GB 空间，模型缓存保存在 `models/`。下载完成后可勾选“仅使用已下载模型”。长影片可能需要较长处理时间，界面进度表示音轨已处理的位置，不是预计剩余时间。

若环境需要重建，在 PowerShell 运行 `powershell -ExecutionPolicy Bypass -File setup.ps1`，需要 uv。依赖通过 PyAV 解码，无需另外安装 FFmpeg。识别使用默认第一条音轨，多音轨影片请先选取所需英语音轨。

## 使用

1. 选择影片或音频。可填写人物名、术语等英文提示。
2. 选择 large-v3 并生成字幕。取消会等待当前下载/片段结束。
3. 选择字幕行，修改秒数与文字，点击“应用修改”。
4. 点击“保存校正并导出”，文件在 `output/独立任务目录/`：SRT、VTT、TXT、JSON。JSON 保留原始词时间及置信度和校正后的字幕。
5. “视频同步预览”在浏览器中打开本地预览，点击字幕可跳转。浏览器不能播放部分 MKV/编码格式时，用 VLC 打开原影片并载入 `subtitles.srt`。
6. 下次可用“打开已保存任务”选择 `subtitles.json`，继续校正而不必重新识别。原影片移动后需恢复原路径才能预览。

字幕按词时间、停顿和标点分句，目标为两行，每行 42 个字符、最长 6 秒。极长单词和异常模型时间戳可能超出目标。时间戳来自 Whisper；本版本没有集成 WhisperX 强制对齐，也没有实时识别或烧录视频功能。

处理在本机完成，首次下载依赖/模型会连接软件源；没有影片上传或付费 API。音乐、重叠对白、口音、人名及低音量可能产生误识别。不能承诺固定准确率；正式使用请校正。

## 命令行

`.venv\Scripts\python.exe app.py --input "C:\path\movie.mp4" --offline`

## 上游开源项目

- https://github.com/SYSTRAN/faster-whisper (MIT)
- https://github.com/openai/whisper (MIT，代码及模型)

## 验证

`.venv\Scripts\python.exe -m unittest discover -s tests -v`

已在此电脑验证：GUI 初始化与结果编辑、五项字幕格式/分句/导出检查，以及 large-v3 CPU INT8 离线识别 `samples/jfk.wav` 和带同一音轨的 `samples/jfk.mp4` 的完整流程。浏览器预览脚本通过 Node 语法检查；尚未逐个验证浏览器视频编码兼容性。安装依赖固定在 `requirements-lock.txt`，其中 PyAV 16.0.1 与 faster-whisper 1.2.1 配套使用。

实际识别质量还需要代表性影片和人工参考字幕，用词错误率（WER）与字幕同步误差衡量。
