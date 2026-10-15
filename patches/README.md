# Vidstack 1.15.7 生命周期兼容补丁

`SliderPreview` 的 `ResizeObserver` 会排队执行下一帧的位置更新。视频报错或路由切换后，滑杆已销毁，队列中的回调仍可能先访问滑杆状态，产生 `disabled is not a function`（生产压缩后为 `e is not a function`）。

补丁在读取滑杆状态前确认预览元素仍连接到文档、组件仍处于连接阶段，覆盖依赖的开发、生产及服务端入口。由 Bun `patchedDependencies` 自动应用，Docker 生产依赖安装也复制该目录。

回归：`apps/web/e2e/players.spec.ts` 的视频错误与重试用例，同时要求无未捕获浏览器异常。Chromium 156 中未修复版本重复运行 3 次、失败 2 次；应用补丁后连续 5 次通过。升级 Vidstack 时重新核对补丁是否仍有必要。
