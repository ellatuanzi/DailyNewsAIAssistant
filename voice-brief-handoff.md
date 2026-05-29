# 语音早报接入说明

当前已具备的本地能力：

- 中文播报稿转音频：[`/Users/qingcai/Documents/Morning News/render_tts_audio.sh`](/Users/qingcai/Documents/Morning%20News/render_tts_audio.sh)
- 规范补充：[`/Users/qingcai/Documents/Morning News/automation-2-notes.md`](/Users/qingcai/Documents/Morning%20News/automation-2-notes.md)

建议接入流程：

1. 先照常生成当天邮件正文。
2. 另外生成一份 5-8 分钟的“播报稿”纯文本，不要包含长链接。
3. 运行：
   `./render_tts_audio.sh spoken-script.txt /private/tmp/morning-brief-YYYY-MM-DD.aiff`
4. 调用 Gmail 发送邮件时，把该 `.aiff` 文件作为附件一并发送。
5. 如果音频生成失败，正文邮件仍然发送，并在任务输出里注明失败原因。
6. 发送前再次确认：
   - 附件路径存在且可读
   - Gmail 调用里已传入 `attachment_files`
   - 若正文写到某个板块受影响，正文里已补充该板块核心公司

备注：

- 这台机器上 `.aiff` 产出已验证可用。
- `.m4a` 压缩转换在当前环境下失败，因此现阶段应优先发送 `.aiff`。
