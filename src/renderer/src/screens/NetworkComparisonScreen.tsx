import type { DownloadState, FinishedDownload, NetworkInterfaceKind } from '@shared/types'
import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  BarChart3,
  Wifi,
  Network,
  Cable,
  Smartphone,
  CheckSquare,
  Square
} from 'lucide-react'
import { ThroughputChart } from '../components/ThroughputChart'
import { useNetworkVisuals } from '../hooks/useNetworkVisuals'
import { useFormatSpeed } from '../hooks/useFormatSpeed'
import { useAppStore } from '../store/useAppStore'
import { Checkbox } from '../components/ui/checkbox'
import { Button } from '../components/ui/button'
import { formatBytes, formatPercent } from '../utils/format'
import { isFinished } from '../utils/downloadActions'

function kindIcon(kind: NetworkInterfaceKind): React.JSX.Element {
  switch (kind) {
    case 'wifi':
      return <Wifi className="size-3.5" />
    case 'ethernet':
      return <Network className="size-3.5" />
    case 'usb':
      return <Smartphone className="size-3.5" />
    default:
      return <Cable className="size-3.5" />
  }
}

export function NetworkComparisonScreen({
  download
}: {
  download: DownloadState | FinishedDownload
}): React.JSX.Element {
  const setView = useAppStore((store) => store.setView)
  const networkVisual = useNetworkVisuals()
  const formatSpeed = useFormatSpeed()

  // All networks that touched this download or were configured
  const networks = download.networks
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Default to selecting all networks that contributed bytes or are enabled
    const active = networks.filter((n) => n.bytesDownloaded > 0 || n.enabled)
    if (active.length > 0) return new Set(active.map((n) => n.id))
    return new Set(networks.map((n) => n.id))
  })

  const visuals = useMemo(
    () =>
      networks.map((network) => ({
        network,
        visual: networkVisual(network.id, network.kind, network.label)
      })),
    [networks, networkVisual]
  )

  const totalDelivered = useMemo(
    () => networks.reduce((sum, n) => sum + n.bytesDownloaded, 0),
    [networks]
  )

  const speedHistory = download.speedHistory ?? {}

  // Filtered networks for chart
  const selectedVisuals = useMemo(
    () => visuals.filter(({ network }) => selectedIds.has(network.id)),
    [visuals, selectedIds]
  )

  const chartOrder = useMemo(
    () =>
      selectedVisuals.map(({ network, visual }) => ({
        interfaceId: network.id,
        solid: visual.solid,
        name: visual.name
      })),
    [selectedVisuals]
  )

  const toggleNetwork = (id: string, checked: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectAll = (): void => {
    setSelectedIds(new Set(networks.map((n) => n.id)))
  }

  const deselectAll = (): void => {
    setSelectedIds(new Set())
  }

  const finished = isFinished(download)
  const isPaused = !finished && download.status === 'paused'

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b-2 border-black dark:border-white/20 px-5">
        <button
          type="button"
          onClick={() => setView({ name: 'download', id: download.id })}
          className="-ml-2 flex items-center gap-1.5 rounded-md px-2 py-1 font-sans text-[14px] leading-none font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to download
        </button>
        <span className="text-muted-foreground/50">/</span>
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="size-4 shrink-0 text-foreground" />
          <span className="truncate font-sans text-[14px] font-bold text-foreground">
            Network Comparison
          </span>
          <span className="truncate font-mono text-[12px] text-muted-foreground">
            ({download.fileName})
          </span>
        </div>
        <div className="flex-1" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setView({ name: 'list' })}
        >
          Downloads list
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Network Multi-Selector Bar */}
        <div className="rounded-[8px] border-2 border-black dark:border-white/20 bg-card p-4 shadow-[2px_2px_0px_#000]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
                Active Interfaces ({selectedIds.size} of {networks.length} selected)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="h-7 text-xs font-mono"
              >
                <CheckSquare className="size-3.5 mr-1" />
                Select All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                className="h-7 text-xs font-mono"
              >
                <Square className="size-3.5 mr-1" />
                Deselect All
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {visuals.map(({ network, visual }) => {
              const isSelected = selectedIds.has(network.id)
              return (
                <label
                  key={network.id}
                  className={`flex items-center gap-2.5 rounded-[6px] border-2 px-3 py-1.5 cursor-pointer select-none transition-all ${
                    isSelected
                      ? 'border-black dark:border-white bg-accent/40 shadow-[2px_2px_0px_#000]'
                      : 'border-border bg-card/60 opacity-60 hover:opacity-90'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => toggleNetwork(network.id, Boolean(checked))}
                  />
                  <div
                    className="size-3 rounded-full border border-black/40 shrink-0"
                    style={{ backgroundColor: visual.solid }}
                  />
                  <span className="font-sans text-[13px] font-bold leading-none">
                    {visual.name}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {kindIcon(network.kind)}
                    {visual.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground ml-1">
                    {formatBytes(network.bytesDownloaded)}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Speed Chart Section */}
        <div className="rounded-[8px] border-2 border-black dark:border-white/20 bg-card p-4 shadow-[2px_2px_0px_#000]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
              Comparative Speed Curves (Last 60 Seconds)
            </span>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {finished ? 'Finished state' : isPaused ? 'Paused' : 'Live throughput'}
            </span>
          </div>

          {chartOrder.length > 0 ? (
            <div className="overflow-x-auto pt-2">
              <ThroughputChart
                order={chartOrder}
                historyByInterface={speedHistory}
                endsAt={finished ? 'end' : isPaused ? 'pause' : 'now'}
              />
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center text-center text-muted-foreground font-mono text-sm border border-dashed border-border rounded-md">
              Select at least one network adapter above to plot speed comparison curves.
            </div>
          )}
        </div>

        {/* Bandwidth Contribution Segmented Bar */}
        {totalDelivered > 0 && selectedVisuals.length > 0 && (
          <div className="rounded-[8px] border-2 border-black dark:border-white/20 bg-card p-4 shadow-[2px_2px_0px_#000]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
                Payload Delivery Share
              </span>
              <span className="font-mono text-[11px] tabular-nums font-semibold">
                Total Delivered: {formatBytes(totalDelivered)}
              </span>
            </div>
            <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full border-2 border-black dark:border-white/40 bg-muted">
              {selectedVisuals.map(({ network, visual }) => {
                if (network.bytesDownloaded <= 0) return null
                return (
                  <div
                    key={network.id}
                    title={`${visual.name}: ${formatPercent(network.bytesDownloaded, totalDelivered)}% (${formatBytes(network.bytesDownloaded)})`}
                    style={{ flex: network.bytesDownloaded, backgroundColor: visual.solid }}
                    className="h-full transition-all"
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Side-by-Side Network Comparison Table */}
        <div className="rounded-[8px] border-2 border-black dark:border-white/20 bg-card overflow-hidden shadow-[2px_2px_0px_#000]">
          <div className="border-b-2 border-black dark:border-white/20 px-4 py-2.5 bg-muted/30">
            <span className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
              Interface Performance Metrics
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-4 font-semibold">Interface</th>
                  <th className="py-2.5 px-4 font-semibold">Kind</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Data Delivered</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Share</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Peak Rate</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Current Speed</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Retries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visuals.map(({ network, visual }) => {
                  const history = speedHistory[network.id] ?? []
                  const peakRate = history.length > 0 ? Math.max(0, ...history) : 0
                  const isSelected = selectedIds.has(network.id)

                  return (
                    <tr
                      key={network.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-card' : 'opacity-50 bg-muted/5'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-3 rounded-full border border-black/40 shrink-0"
                            style={{ backgroundColor: visual.solid }}
                          />
                          <span className="font-bold">{visual.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            ({network.label})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase bg-muted px-2 py-0.5 rounded border border-border">
                          {kindIcon(network.kind)}
                          {visual.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {formatBytes(network.bytesDownloaded)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {totalDelivered > 0
                          ? `${formatPercent(network.bytesDownloaded, totalDelivered)}%`
                          : '0%'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-foreground">
                        {peakRate > 0 ? formatSpeed(peakRate) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-foreground">
                        {!finished && !isPaused && network.speedBytesPerSec > 0
                          ? formatSpeed(network.speedBytesPerSec)
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-muted-foreground">
                        {network.retries}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
