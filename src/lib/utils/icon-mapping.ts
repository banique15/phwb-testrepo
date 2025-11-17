import type { ComponentType, SvelteComponent } from 'svelte'
import {
	Clipboard,
	ClipboardList,
	CheckCircle,
	Check,
	Search,
	BarChart,
	TrendingUp,
	Calendar,
	FileText,
	Edit,
	Pencil,
	Settings,
	User,
	Globe,
	Users,
	DollarSign,
	Coins,
	Building,
	Building2,
	Landmark,
	Mic,
	Music,
	Lightbulb,
	Utensils,
	Lock,
	XCircle,
	AlertTriangle,
	Info,
	Plus,
	Trash,
	CreditCard,
	RefreshCw,
	Upload,
	Target,
	MapPin,
	Car,
	DoorOpen,
	Theater,
	Music2,
	Sliders,
	Sparkles,
	Shirt,
	Compass,
	PartyPopper,
	Keyboard,
	Home
} from 'lucide-svelte'

/**
 * Mapping of emoji strings to Lucide icon components
 */
export const emojiToIcon: Record<string, ComponentType<SvelteComponent>> = {
	'📋': ClipboardList,
	'✅': CheckCircle,
	'🔍': Search,
	'📊': BarChart,
	'📅': Calendar,
	'🎭': Theater,
	'📝': FileText,
	'⚙️': Settings,
	'👤': User,
	'🌐': Globe,
	'👥': Users,
	'💰': DollarSign,
	'🏢': Building,
	'🏛️': Landmark,
	'🎤': Mic,
	'🎵': Music,
	'💡': Lightbulb,
	'🍽️': Utensils,
	'🔒': Lock,
	'❌': XCircle,
	'⚠️': AlertTriangle,
	'ℹ️': Info,
	'➕': Plus,
	'✏️': Edit,
	'🗑️': Trash,
	'💳': CreditCard,
	'🔄': RefreshCw,
	'📤': Upload,
	'🎯': Target,
	'📍': MapPin,
	'🚗': Car,
	'🚪': DoorOpen,
	'🎚️': Sliders,
	'👔': Shirt,
	'📄': FileText,
	'⭐': Sparkles,
	'🧭': Compass,
	'🎉': PartyPopper
}

/**
 * Get a Lucide icon component from an emoji string
 */
export function getIconFromEmoji(emoji: string): ComponentType<SvelteComponent> | null {
	return emojiToIcon[emoji] || null
}

/**
 * Get icon component for requirement categories based on key
 */
export function getRequirementIcon(key: string): ComponentType<SvelteComponent> {
	const lowerKey = key.toLowerCase()
	if (lowerKey.includes('equipment')) return Music
	if (lowerKey.includes('sound') || lowerKey.includes('audio')) return Sliders
	if (lowerKey.includes('mic') || lowerKey.includes('microphone')) return Mic
	if (lowerKey.includes('stage') || lowerKey.includes('platform')) return Theater
	if (lowerKey.includes('lighting') || lowerKey.includes('light')) return Lightbulb
	if (lowerKey.includes('parking')) return Car
	if (lowerKey.includes('security')) return Lock
	if (lowerKey.includes('catering') || lowerKey.includes('food')) return Utensils
	if (lowerKey.includes('dress') || lowerKey.includes('attire')) return Shirt
	if (lowerKey.includes('access') || lowerKey.includes('entry')) return DoorOpen
	return ClipboardList
}

/**
 * Get icon component for audit actions
 */
export function getAuditActionIcon(action: string): ComponentType<SvelteComponent> {
	switch (action) {
		case 'CREATE':
			return Plus
		case 'UPDATE':
			return Edit
		case 'DELETE':
			return Trash
		case 'APPROVE':
			return CheckCircle
		case 'REJECT':
			return XCircle
		case 'PROCESS':
			return CreditCard
		case 'RECONCILE':
			return RefreshCw
		case 'EXPORT':
			return Upload
		default:
			return FileText
	}
}

/**
 * Get icon component for payment status
 */
export function getPaymentStatusIcon(status: string): ComponentType<SvelteComponent> {
	switch (status) {
		case 'PLANNED':
			return Calendar
		case 'APPROVED':
			return CheckCircle
		case 'PAID':
			return CreditCard
		case 'COMPLETED':
			return Target
		case 'CANCELLED':
			return XCircle
		default:
			return Info
	}
}

/**
 * Get icon component for event status
 */
export function getEventStatusIcon(status: string): ComponentType<SvelteComponent> {
	switch (status) {
		case 'planned':
			return ClipboardList
		case 'confirmed':
			return CheckCircle
		case 'in_progress':
			return Music
		case 'completed':
			return PartyPopper
		case 'cancelled':
			return XCircle
		default:
			return ClipboardList
	}
}

/**
 * Get icon component for toast type
 */
export function getToastIcon(type: 'success' | 'error' | 'warning' | 'info'): ComponentType<SvelteComponent> {
	switch (type) {
		case 'success':
			return CheckCircle
		case 'error':
			return XCircle
		case 'warning':
			return AlertTriangle
		case 'info':
			return Info
		default:
			return Info
	}
}

/**
 * Get icon component for help section
 */
export function getHelpIcon(iconName: string): ComponentType<SvelteComponent> | null {
	const iconMap: Record<string, ComponentType<SvelteComponent>> = {
		'🎨': Sparkles,
		'🔍': Search,
		'👤': User,
		'✏️': Edit,
		'⌨️': Keyboard,
		'🏠': Home,
		'🧭': Compass,
		'⭐': Sparkles
	}
	
	return iconMap[iconName] || null
}

