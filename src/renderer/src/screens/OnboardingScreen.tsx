import { useState, useEffect } from 'react'
import {
  Wifi,
  Smartphone,
  Network,
  CheckCircle2,
  XCircle,
  Zap,
  Gauge,
  Clock,
  ArrowRight,
  ArrowLeft,
  X
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAppStore } from '../store/useAppStore'

export function OnboardingScreen(): React.JSX.Element | null {
  const onboardingOpen = useAppStore((store) => store.onboardingOpen)
  const completeOnboarding = useAppStore((store) => store.completeOnboarding)
  const closeOnboarding = useAppStore((store) => store.closeOnboarding)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    if (!onboardingOpen) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closeOnboarding()
      } else if (e.key === 'ArrowRight' && slide < 2) {
        setSlide((prev) => prev + 1)
      } else if (e.key === 'ArrowLeft' && slide > 0) {
        setSlide((prev) => prev - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onboardingOpen, slide, closeOnboarding])

  if (!onboardingOpen) return null

  const handleNext = (): void => {
    if (slide < 2) {
      setSlide((prev) => prev + 1)
    } else {
      completeOnboarding()
    }
  }

  const handleBack = (): void => {
    if (slide > 0) {
      setSlide((prev) => prev - 1)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border-2 border-black dark:border-white/20 bg-background shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-black/10 dark:border-white/10 px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md bg-[var(--color-accent)] font-mono text-xs font-bold text-black border border-black/30">
              ⚡
            </span>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Welcome to Pulse • Slide {slide + 1} of 3
              </span>
              <span className="text-sm font-bold text-foreground">Getting Started Guide</span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close guide"
            onClick={closeOnboarding}
            className="rounded-full hover:bg-muted"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Content Body */}
        <div className="min-h-[380px] flex-1 overflow-y-auto p-6 flex flex-col justify-between">
          {slide === 0 && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
              <div>
                <span className="inline-block rounded-full bg-[var(--color-accent)]/20 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-accent-onsolid)]">
                  Requirement #1
                </span>
                <h2
                  id="onboarding-title"
                  className="text-xl font-bold tracking-tight text-foreground mt-1"
                >
                  Separate Internet Connections Required
                </h2>
                <p className="text-[13.5px] text-muted-foreground mt-1 leading-relaxed">
                  Pulse bonds multiple network adapters simultaneously. To multiply your speed, each
                  adapter must reach the internet through an <strong>independent path</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                {/* Working setup */}
                <div className="flex flex-col rounded-lg border-2 border-green-500/60 bg-green-500/5 p-3.5">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-xs mb-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>COMBINES SPEED (RECOMMENDED)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <Wifi className="size-4 text-[var(--color-wifi)]" /> Home Wi-Fi +
                    <Smartphone className="size-4 text-[var(--color-usb)]" /> 5G/4G USB Tether
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-2 leading-snug">
                    Two completely independent ISP pipes. 50 MB/s Wi-Fi + 30 MB/s 5G = up to 80
                    MB/s!
                  </p>
                </div>

                {/* Non-working setup */}
                <div className="flex flex-col rounded-lg border-2 border-red-500/60 bg-red-500/5 p-3.5">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-xs mb-2">
                    <XCircle className="size-4 shrink-0" />
                    <span>NO SPEED INCREASE</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <Wifi className="size-4 text-[var(--color-wifi)]" /> Wi-Fi +
                    <Network className="size-4 text-[var(--color-ethernet)]" /> Ethernet on Same
                    Router
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-2 leading-snug">
                    Both adapters share the exact same broadband subscription. Total bandwidth
                    cannot exceed the ISP plan.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 border border-border p-3 text-[12px] text-muted-foreground leading-relaxed">
                💡 <strong>Quick Start:</strong> Plug your smartphone into your PC with a USB cable,
                open <em>Settings &rarr; Hotspot &amp; Tethering</em>, and turn on{' '}
                <strong>USB Tethering</strong>. Pulse will instantly detect and bind it!
              </div>
            </div>
          )}

          {slide === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
              <div>
                <span className="inline-block rounded-full bg-[var(--color-wifi)]/20 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-wifi)]">
                  Architecture
                </span>
                <h2
                  id="onboarding-title"
                  className="text-xl font-bold tracking-tight text-foreground mt-1"
                >
                  Chunk Combining &amp; Speculative Racing
                </h2>
                <p className="text-[13.5px] text-muted-foreground mt-1 leading-relaxed">
                  Pulse splits incoming files into parallel blocks. Each network connection pulls
                  chunks at its maximum native speed.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border-2 border-border bg-card p-4">
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-muted-foreground">
                  <span>PARALLEL SOCKET PIPELINE</span>
                  <span>100% STANDALONE (NO VPN)</span>
                </div>

                {/* Simulated chunk lanes */}
                <div className="flex flex-col gap-2 my-2 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-16 font-semibold text-[var(--color-wifi)]">Wi-Fi:</span>
                    <div className="flex flex-1 gap-1">
                      <div className="flex-1 py-1 px-2 rounded bg-[var(--color-wifi)] text-white text-center font-bold">
                        Chunk #1
                      </div>
                      <div className="flex-1 py-1 px-2 rounded bg-[var(--color-wifi)] text-white text-center font-bold">
                        Chunk #3
                      </div>
                      <div className="flex-1 py-1 px-2 rounded bg-[var(--color-wifi)] text-white text-center font-bold">
                        Chunk #5
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-16 font-semibold text-[var(--color-usb)]">5G USB:</span>
                    <div className="flex flex-1 gap-1">
                      <div className="flex-1 py-1 px-2 rounded bg-[var(--color-usb)] text-black text-center font-bold">
                        Chunk #2
                      </div>
                      <div className="flex-1 py-1 px-2 rounded bg-[var(--color-usb)] text-black text-center font-bold">
                        Chunk #4
                      </div>
                      <div className="flex-1 py-1 px-2 rounded bg-[var(--color-usb)] text-black text-center font-bold">
                        Chunk #6
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
                  <Zap className="size-4 text-[var(--color-accent)] shrink-0" />
                  <span>
                    <strong>Direct Disk Reassembly:</strong> Blocks write to disk concurrently at
                    pre-calculated byte offsets. No waiting for reassembly when finished!
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 border border-border p-3 text-[12px] text-muted-foreground leading-relaxed">
                ⚡ <strong>Speculative Racing:</strong> If an adapter drops packets or slows down,
                Pulse automatically re-dispatches those chunks to the fastest active pipe so
                downloads never stall.
              </div>
            </div>
          )}

          {slide === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
              <div>
                <span className="inline-block rounded-full bg-[var(--color-ethernet)]/20 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-ethernet)]">
                  Controls &amp; Power
                </span>
                <h2
                  id="onboarding-title"
                  className="text-xl font-bold tracking-tight text-foreground mt-1"
                >
                  Slow Mode, Schedules &amp; Data Caps
                </h2>
                <p className="text-[13.5px] text-muted-foreground mt-1 leading-relaxed">
                  Fine-tune bandwidth allocation so your downloads never interrupt your daily
                  workflow or mobile limits.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-1">
                <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Gauge className="size-4 text-[var(--color-usb)]" />
                    <span>Slow Mode</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground leading-snug">
                    One-click throttle to keep video calls and streaming buttery smooth during
                    downloads.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Clock className="size-4 text-[var(--color-wifi)]" />
                    <span>Night Schedule</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground leading-snug">
                    Queue large downloads to run during free off-peak hours (e.g. 2:00 AM – 7:00
                    AM).
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Smartphone className="size-4 text-[var(--color-ethernet)]" />
                    <span>Data Caps</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground leading-snug">
                    Set daily, weekly, or monthly cellular limits per network to prevent data
                    overages.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-[var(--color-accent)]/15 border-2 border-[var(--color-accent)]/40 p-3 text-[12.5px] font-medium text-foreground leading-relaxed">
                🎉 <strong>You&apos;re ready to go!</strong> Paste any download URL or magnet link,
                or click &ldquo;⚡ Open in Pulse&rdquo; on web downloads to get started.
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation Toolbar */}
        <div className="flex items-center justify-between border-t-2 border-black/10 dark:border-white/10 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => setSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  slide === index
                    ? 'w-6 bg-[var(--color-accent)] border border-black dark:border-white/30'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={completeOnboarding}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip
            </Button>

            {slide > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleBack}
                className="text-xs gap-1"
              >
                <ArrowLeft className="size-3.5" /> Back
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className={`text-xs gap-1 font-semibold ${
                slide === 2
                  ? 'bg-[var(--color-accent)] text-black border border-black hover:brightness-105'
                  : ''
              }`}
            >
              {slide === 2 ? (
                <>Get Started ⚡</>
              ) : (
                <>
                  Next <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
