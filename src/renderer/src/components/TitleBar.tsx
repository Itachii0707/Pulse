import { TITLE_BAR_HEIGHT } from '../theme'
import appIcon from '../assets/icon.png'

const isMac = window.plexo.platform === 'darwin'

/** The window's title bar, the same on every OS: its name and icon on a strip the window is
 * dragged by. The OS's own controls sit over it (see main/index.ts): macOS's traffic lights at
 * the left, Windows' and Linux's minimize/maximize/close at the right. */
export function TitleBar(): React.JSX.Element {
  return (
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`flex shrink-0 items-center justify-between border-b-2 border-black dark:border-white/20 bg-[#FFFDF7] dark:bg-[#1A1A1A] [-webkit-app-region:drag] ${
        isMac ? 'px-4 pl-[76px]' : 'px-4 pr-[140px]'
      }`}
    >
      <div className="flex items-center gap-2 select-none">
        <img
          src={appIcon}
          alt="Pulse"
          className="size-5 rounded-[3px] border border-black dark:border-white/40 shadow-[1px_1px_0px_#000] object-cover"
        />
        <span className="font-sans text-[12px] font-extrabold tracking-wider text-black dark:text-white uppercase">
          PULSE
        </span>
      </div>
      <div className="text-[10px] font-mono font-bold text-black/60 dark:text-white/60 uppercase tracking-widest hidden sm:block">
        Multi-Pipe Socket Bonding
      </div>
    </div>
  )
}
