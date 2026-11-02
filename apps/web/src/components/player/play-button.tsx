import { useButton } from "@videojs/react";
import { usePlayer } from "@videojs/react/audio";
import type { ReactNode, Ref } from "react";

/** 在 Video.js 统一的鼠标/键盘激活点记录意图，早于异步媒体 pause/error 事件。 */
export function MusicPlayButton({
  children,
  className,
  label,
  onIntent,
}: {
  children: ReactNode;
  className: string;
  label: string;
  onIntent: (play: boolean) => void;
}) {
  const player = usePlayer();
  const { getButtonProps, buttonRef } = useButton({
    displayName: "MusicPlayButton",
    isDisabled: () => !player.target,
    onActivate: () => {
      const play = player.state.paused;
      onIntent(play);
      if (play) void player.play().catch(() => {});
      else player.pause();
    },
  });
  return (
    <button
      {...getButtonProps()}
      ref={buttonRef as Ref<HTMLButtonElement>}
      type="button"
      aria-label={label}
      className={className}
    >
      {children}
    </button>
  );
}
