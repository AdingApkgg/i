# 播放器媒体夹具

这些文件由 FFmpeg 的纯色画面和正弦波生成，无外部版权素材或网络依赖。浏览器用例通过支持 HTTP Range 的响应提供它们，验证真实解码、拖动进度和 HLS。运行测试不需要 FFmpeg。

在远程开发机重新生成：

```sh
ffmpeg -f lavfi -i color=c=pink:s=320x180:r=10 -f lavfi -i sine=frequency=440:sample_rate=22050 -t 8 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart sample.mp4
ffmpeg -i sample.mp4 -c copy -hls_time 2 -hls_list_size 0 stream.m3u8
mv stream0.ts stream0.segment
sed -i 's/stream0.ts/stream0.segment/' stream.m3u8
ffmpeg -f lavfi -i sine=frequency=440:sample_rate=8000 -t 12 -c:a pcm_s16le tone.wav
```

HLS 分片使用 `.segment` 扩展名，避免 TypeScript 把 MPEG-TS 当成源文件。
