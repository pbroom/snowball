import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, Moon02Icon, Sun02Icon } from "@hugeicons/core-free-icons";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="theme-select" className="sr-only">
        Theme
      </Label>
      <Select value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
        <SelectTrigger id="theme-select" className="w-full" aria-label="Theme">
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
