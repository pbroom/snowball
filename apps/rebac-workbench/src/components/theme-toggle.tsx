import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, Moon02Icon, Sun02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type ThemePreference, useTheme } from "@/theme-provider";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun02Icon;
}[] = [
  { value: "light", label: "Light", icon: Sun02Icon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
  { value: "system", label: "System", icon: ComputerIcon }
];

export function ThemeToggle(props: { variant?: "field" | "icon"; className?: string }) {
  const { theme, setTheme } = useTheme();
  const selectedTheme = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const variant = props.variant ?? "field";
  const uid = useId();
  const id = variant === "icon" ? `theme-menu-${uid}` : `theme-select-${uid}`;

  useEffect(() => {
    if (variant !== "icon" || !isOpen) {
      return;
    }

    const selectedIndex = THEME_OPTIONS.findIndex((option) => option.value === theme);
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setFocusedIndex(nextIndex);
    menuItemRefs.current[nextIndex]?.focus();
  }, [isOpen, theme, variant]);

  if (variant === "icon") {
    function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setIsOpen(false);
      }
    }

    function closeMenu(returnFocus = true) {
      setIsOpen(false);
      if (returnFocus) {
        triggerRef.current?.focus();
      }
    }

    function focusMenuItem(index: number) {
      const nextIndex = (index + THEME_OPTIONS.length) % THEME_OPTIONS.length;
      setFocusedIndex(nextIndex);
      menuItemRefs.current[nextIndex]?.focus();
    }

    function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!isOpen) {
          const selectedIndex = THEME_OPTIONS.findIndex((option) => option.value === theme);
          setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
          setIsOpen(true);
        }
      }
    }

    function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusMenuItem(focusedIndex + 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusMenuItem(focusedIndex - 1);
      }
    }

    function handleMenuItemKeyDown(event: KeyboardEvent<HTMLButtonElement>, option: ThemePreference) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setTheme(option);
        closeMenu();
      }
    }

    return (
      <div className={cn("relative", props.className)} onBlur={closeWhenFocusLeaves}>
        <Button
          ref={triggerRef}
          type="button"
          id={id}
          variant="outline"
          size="icon-lg"
          aria-label="Theme"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={handleTriggerKeyDown}
        >
          <HugeiconsIcon icon={selectedTheme.icon} strokeWidth={2} aria-hidden />
        </Button>
        {isOpen ? (
          <div
            role="menu"
            aria-labelledby={id}
            onKeyDown={handleMenuKeyDown}
            className="absolute right-0 top-full z-50 mt-1 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            {THEME_OPTIONS.map((option, index) => (
              <button
                key={option.value}
                ref={(element) => {
                  menuItemRefs.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={theme === option.value}
                tabIndex={focusedIndex === index ? 0 : -1}
                className={cn(
                  "flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                  theme === option.value && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  setTheme(option.value);
                  closeMenu(false);
                }}
                onKeyDown={(event) => handleMenuItemKeyDown(event, option.value)}
              >
                <HugeiconsIcon icon={option.icon} strokeWidth={2} aria-hidden />
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", props.className)}>
      <Label htmlFor={id} className="sr-only">
        Theme
      </Label>
      <Select value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
        <SelectTrigger id={id} className="w-full" aria-label="Theme">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {THEME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-2">
                  <HugeiconsIcon icon={option.icon} strokeWidth={2} aria-hidden />
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
