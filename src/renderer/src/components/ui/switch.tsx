import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from 'cn'

function Switch({ className, ...props }: SwitchPrimitive.Root.Props): React.JSX.Element {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-[24px] w-[42px] shrink-0 items-center rounded-full border-2 border-black bg-[#EAE6DD] dark:bg-[#333333] p-0.5 transition-colors outline-none shadow-[2px_2px_0px_#000000] disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-[#4CAF50]',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full border border-black bg-white shadow-sm transition-transform data-checked:translate-x-[18px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
