import type * as Kit from '@sveltejs/kit'
import type { EnhancedEvent } from './+page.server'

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never
type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? { [P in Exclude<A, keyof U>]?: never } & U : never
type PageParent = import('../$types').LayoutData
type LayoutRouteId = RouteId | "/(app)" | null
type RouteId = "/(app)/events"

export type PageServerData = {
	events: EnhancedEvent[]
}

export type PageData = Expand<PageServerData>

export type Actions = {}

export type PageLoad<OutputData extends Record<string, any> | void = any> = Kit.Load<RouteParams, Kit.ServerLoad<RouteParams, OutputData>, PageParent, OutputData, RouteId>

export type PageServerLoad<OutputData extends Record<string, any> | void = any> = Kit.ServerLoad<RouteParams, OutputData, PageParent, RouteId>

export type Action<OutputData extends Record<string, any> | void = any> = Kit.Action<RouteParams, OutputData, PageParent, RouteId>

export type RequestHandler = Kit.RequestHandler<RouteParams, RouteId>

export type RouteParams = {}