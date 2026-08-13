/**
 * 旧 Hexo (Butterfly) 主题的 FontAwesome 类名 → lucide 图标。
 * 导入的文章里写的是 `fas fa-xxx`，按关键词模糊匹配即可。
 */
import {
  Ban,
  Bell,
  Book,
  Bug,
  Check,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Download,
  Flame,
  Gamepad2,
  Gift,
  Heart,
  Info,
  Key,
  Lightbulb,
  Link as LinkIcon,
  type LucideIcon,
  Megaphone,
  Music,
  Paperclip,
  PawPrint,
  Quote,
  Rocket,
  Star,
  TriangleAlert,
} from "lucide-react";

const MATCHERS: [RegExp, LucideIcon][] = [
  [/info/, Info],
  [/question|help/, CircleHelp],
  [/exclamation-triangle|warning/, TriangleAlert],
  [/exclamation/, CircleAlert],
  [/check-circle|circle-check/, CircleCheck],
  [/check/, Check],
  [/times-circle|circle-xmark|xmark/, CircleX],
  [/ban/, Ban],
  [/bell/, Bell],
  [/book/, Book],
  [/bug/, Bug],
  [/bullhorn|megaphone/, Megaphone],
  [/download/, Download],
  [/fire|flame/, Flame],
  [/gamepad/, Gamepad2],
  [/gift/, Gift],
  [/heart/, Heart],
  [/key/, Key],
  [/lightbulb|bulb/, Lightbulb],
  [/link/, LinkIcon],
  [/music/, Music],
  [/paperclip/, Paperclip],
  [/paw/, PawPrint],
  [/quote/, Quote],
  [/rocket/, Rocket],
  [/star/, Star],
];

/** 解析 FA 类名；`none`/空 → null，未识别 → Info 兜底。 */
export function faIcon(icon?: string): LucideIcon | null {
  if (!icon || icon === "none") return null;
  const name = icon.toLowerCase();
  for (const [re, cmp] of MATCHERS) if (re.test(name)) return cmp;
  return Info;
}
