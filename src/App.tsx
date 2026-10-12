import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight, ArrowUpRight, Bell, BookOpen, BookOpenCheck, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Languages, LayoutDashboard,
  Lightbulb, Menu, Mic, MoreHorizontal, Play, Plus, Search, Send, Settings2, BrainCircuit,
  ShieldCheck, Target, TrendingUp, Zap
} from 'lucide-react'

type Lang = 'en' | 'rw'
type AccountUser = { id: string; fullName: string; email: string; role: string; preferredLanguage: Lang; gradeLevel?: string | null }