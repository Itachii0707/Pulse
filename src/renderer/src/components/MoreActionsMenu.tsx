import { Ellipsis, FileDown, Pause, Play, RotateCcw, Trash2 } from 'lucide-react'
import { Fragment } from 'react'
import type { AvailableAction } from '../utils/downloadActions'
import { useDownloadActions } from './downloadActionsContext'
import { ACTION_META, menuLabel } from './downloadActionMeta'
import { useAppStore } from '../store/useAppStore'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/** The "More actions" / "Bulk actions" menu: offers selection actions and bulk operations
 * (Pause all, Resume all, Retry all failed, Remove all finished). */
export function MoreActionsMenu({
  groups = [],
  disabled = false,
  showBulkActions = true
}: {
  groups?: AvailableAction[][]
  disabled?: boolean
  showBulkActions?: boolean
}): React.JSX.Element | null {
  const { perform, pauseAll, resumeAll, retryAllFailed, removeAllFinished } = useDownloadActions()
  const downloads = useAppStore((store) => store.downloads)
  const history = useAppStore((store) => store.history)

  const activeCount = Object.values(downloads).filter(
    (d) => d.status === 'downloading' || d.status === 'queued'
  ).length
  const pausedCount = Object.values(downloads).filter((d) => d.status === 'paused').length
  const failedCount = Object.values(downloads).filter((d) => d.status === 'error').length
  const finishedCount =
    history.length + Object.values(downloads).filter((d) => d.status === 'completed').length

  const hasBulk =
    showBulkActions && (activeCount > 0 || pausedCount > 0 || failedCount > 0 || finishedCount > 0)

  if (groups.length === 0 && !hasBulk) return null

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  aria-label={groups.length > 0 ? 'More actions' : 'Bulk actions'}
                  disabled={disabled}
                >
                  <Ellipsis />
                </Button>
              }
            />
          }
        />
        <TooltipContent>{groups.length > 0 ? 'More actions' : 'Bulk actions'}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-52">
        {groups.map((group, index) => (
          <Fragment key={group[0].id}>
            {index > 0 && <DropdownMenuSeparator />}
            {group.map(({ id, targets }) => {
              const meta = ACTION_META[id]
              return (
                <DropdownMenuItem
                  key={id}
                  variant={meta.destructive ? 'destructive' : 'default'}
                  onClick={() => void perform(id, targets)}
                >
                  <meta.icon aria-hidden />
                  {menuLabel(id, targets)}
                </DropdownMenuItem>
              )
            })}
          </Fragment>
        ))}

        {hasBulk && (
          <>
            {groups.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem disabled={activeCount === 0} onClick={() => void pauseAll()}>
              <Pause aria-hidden className="size-4" />
              Pause all {activeCount > 0 ? `(${activeCount})` : ''}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={pausedCount === 0} onClick={() => void resumeAll()}>
              <Play aria-hidden className="size-4" />
              Resume all {pausedCount > 0 ? `(${pausedCount})` : ''}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={failedCount === 0} onClick={() => void retryAllFailed()}>
              <RotateCcw aria-hidden className="size-4" />
              Retry all failed {failedCount > 0 ? `(${failedCount})` : ''}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={finishedCount === 0}
              variant="destructive"
              onClick={removeAllFinished}
            >
              <Trash2 aria-hidden className="size-4" />
              Remove all finished {finishedCount > 0 ? `(${finishedCount})` : ''}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={finishedCount === 0}
              onClick={() => void window.plexo.exportHistory('csv')}
            >
              <FileDown aria-hidden className="size-4" />
              Export history (CSV)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
