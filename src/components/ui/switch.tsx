import * as React from "react"

import { cn } from "@/lib/utils"

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, defaultChecked = false, disabled, onCheckedChange, ...props }, ref) => {
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked)
    const isControlled = checked !== undefined
    const isChecked = isControlled ? checked : uncontrolledChecked

    function setCheckedValue(next: boolean) {
      if (!isControlled) {
        setUncontrolledChecked(next)
      }
      onCheckedChange?.(next)
    }

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-state={isChecked ? "checked" : "unchecked"}
        disabled={disabled}
        onClick={() => setCheckedValue(!isChecked)}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-[#D4E8E7] p-0.5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#88C1BD]/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#88C1BD]",
          className
        )}
        {...props}
      >
        <span
          data-state={isChecked ? "checked" : "unchecked"}
          className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-5"
        />
      </button>
    )
  }
)

Switch.displayName = "Switch"

export { Switch }
