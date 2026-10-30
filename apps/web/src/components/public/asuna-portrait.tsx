/** 人物来自仓库已有亚丝娜模型的静帧；几何背景为本站绘制，不额外启动 Live2D。 */
export function AsunaPortrait() {
  return (
    <div role="img" aria-label="白与绯红的剑士：Asuna" className="asuna-portrait">
      <svg
        aria-hidden="true"
        viewBox="0 0 520 680"
        className="asuna-portrait-field"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
      >
        <g className="portrait-geometry">
          <circle cx="270" cy="276" r="192" />
          <circle cx="270" cy="276" r="205" strokeDasharray="2 14" />
          <path d="M45 276H495M270 55V493M63 69l9 9-9 9-9-9zM461 443l8 8-8 8-8-8z" />
          <path d="M389 54h63l-8 15h-47zM394 75h53l-9 13h-35zM400 93h40l-10 14h-20zM405 114h30l-15 22zM395 50v-8h7v-8h6V23h8v16h8V14h6v25h10v-9h6v20" />
          <path d="M51 530v33h33M454 124h28v29M81 616h358M258 600l9 9-9 9-9-9z" />
        </g>
      </svg>
      <img
        data-portrait-figure
        src="/images/asuna-aincrad.webp"
        width="821"
        height="2000"
        alt=""
        fetchPriority="high"
        decoding="async"
        className="asuna-character"
      />
    </div>
  );
}
