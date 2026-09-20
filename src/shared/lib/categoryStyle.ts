import {
  Baby,
  Beer,
  Bike,
  BookOpen,
  Bus,
  Car,
  Coffee,
  Dog,
  Droplets,
  Dumbbell,
  Ellipsis,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Music,
  PartyPopper,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tent,
  TrainFront,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Icons a category (or pot) can use. Rows store the icon NAME; a curated registry keeps the
 * bundle small (importing lucide dynamically by name would pull in every icon).
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  House,
  ShoppingBasket,
  Utensils,
  Coffee,
  Beer,
  Bus,
  TrainFront,
  Car,
  Fuel,
  Bike,
  Plane,
  Tent,
  Smartphone,
  Wifi,
  Zap,
  Droplets,
  PartyPopper,
  Film,
  Music,
  Gamepad2,
  Dumbbell,
  ShoppingBag,
  Shirt,
  Gift,
  Scissors,
  HeartPulse,
  Pill,
  BookOpen,
  GraduationCap,
  Dog,
  Baby,
  Wrench,
  Landmark,
  Receipt,
  Sparkles,
  PiggyBank,
  ShieldCheck,
  Ellipsis,
}

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS)

export const iconFor = (name: string): LucideIcon => CATEGORY_ICONS[name] ?? Ellipsis

export const CATEGORY_COLORS = [
  'cat-1',
  'cat-2',
  'cat-3',
  'cat-4',
  'cat-5',
  'cat-6',
  'cat-7',
  'cat-8',
  'cat-9',
  'cat-10',
] as const

/*
 * Rows store the color as a token key. Tailwind only generates classes it can see as complete
 * strings, hence the lookup tables instead of `bg-${color}`.
 */
const CHIP: Record<string, string> = {
  'cat-1': 'bg-cat-1/15 text-cat-1',
  'cat-2': 'bg-cat-2/15 text-cat-2',
  'cat-3': 'bg-cat-3/15 text-cat-3',
  'cat-4': 'bg-cat-4/15 text-cat-4',
  'cat-5': 'bg-cat-5/15 text-cat-5',
  'cat-6': 'bg-cat-6/15 text-cat-6',
  'cat-7': 'bg-cat-7/15 text-cat-7',
  'cat-8': 'bg-cat-8/15 text-cat-8',
  'cat-9': 'bg-cat-9/15 text-cat-9',
  'cat-10': 'bg-cat-10/15 text-cat-10',
  saved: 'bg-saved-soft text-saved',
}

const SOLID: Record<string, string> = {
  'cat-1': 'bg-cat-1',
  'cat-2': 'bg-cat-2',
  'cat-3': 'bg-cat-3',
  'cat-4': 'bg-cat-4',
  'cat-5': 'bg-cat-5',
  'cat-6': 'bg-cat-6',
  'cat-7': 'bg-cat-7',
  'cat-8': 'bg-cat-8',
  'cat-9': 'bg-cat-9',
  'cat-10': 'bg-cat-10',
  saved: 'bg-saved',
}

/** Tinted background + colored icon, e.g. for list rows and the category grid. */
export const chipClass = (color: string): string => CHIP[color] ?? CHIP['cat-10']!

/** Solid swatch, e.g. for the color picker and chart legends. */
export const solidClass = (color: string): string => SOLID[color] ?? SOLID['cat-10']!
