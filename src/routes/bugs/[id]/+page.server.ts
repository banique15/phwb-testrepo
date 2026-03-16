import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import type { Bug } from '$lib/schemas/bug'
import type { BugComment } from '$lib/schemas/bug-comment'
import type { BugAttachment } from '$lib/schemas/bug-attachment'
import type { BugLabel } from '$lib/schemas/bug-label'
import type { BugActivity } from '$lib/schemas/bug-activity'
import type { BugTimeTracking } from '$lib/schemas/bug-time-tracking'

export const load: PageServerLoad = async ({ params, locals }) => {
	const bugId = parseInt(params.id, 10)

	if (isNaN(bugId)) {
		throw error(400, 'Invalid bug ID')
	}

	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	// Use service role client to bypass RLS
	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	try {
		// Fetch bug first (required)
		const { data: bug, error: bugError } = await supabase
			.from('phwb_bugs')
			.select('*')
			.eq('id', bugId)
			.maybeSingle()

		if (bugError) {
			if (bugError.code === 'PGRST116' || bugError.message?.includes('0 rows')) {
				throw error(404, 'Bug not found')
			}
			const msg = (bugError as { message?: string }).message ?? String(bugError)
			throw error(500, 'Failed to load bug: ' + msg)
		}
		if (!bug) {
			throw error(404, 'Bug not found')
		}

		// Profiles for bug (reported_by, assigned_to, etc.)
		const userIds = new Set<string>()
		if (bug.reported_by) userIds.add(bug.reported_by)
		if (bug.assigned_to) userIds.add(bug.assigned_to)
		if (bug.resolved_by) userIds.add(bug.resolved_by)
		if (bug.closed_by) userIds.add(bug.closed_by)

		let profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
		if (userIds.size > 0) {
			const { data: profiles, error: profilesError } = await supabase
				.from('profiles')
				.select('id, full_name, avatar_url')
				.in('id', Array.from(userIds))
			if (!profilesError && profiles) {
				profiles.forEach((profile: any) => {
					profilesMap.set(profile.id, { full_name: profile.full_name, avatar_url: profile.avatar_url })
				})
			}
		}

		const bugWithProfiles = {
			...bug,
			profiles_reported: bug.reported_by ? profilesMap.get(bug.reported_by) || null : null,
			profiles_assigned: bug.assigned_to ? profilesMap.get(bug.assigned_to) || null : null,
			profiles_resolved: bug.resolved_by ? { full_name: profilesMap.get(bug.resolved_by)?.full_name || null } : null,
			profiles_closed: bug.closed_by ? { full_name: profilesMap.get(bug.closed_by)?.full_name || null } : null
		}

		// Run all bug-scoped fetches in parallel (resilient: missing tables or errors → empty arrays)
		const fetchOptional = async <T>(
			fn: () => Promise<{ data: T | null; error?: unknown }>,
			fallback: T
		): Promise<T> => {
			try {
				const result = await fn()
				if (result.error) {
					console.warn('Bug detail optional fetch error:', result.error)
					return fallback
				}
				return (result.data ?? fallback) as T
			} catch (e) {
				console.warn('Bug detail optional fetch failed:', e)
				return fallback
			}
		}

		const [
			commentsData,
			attachmentsData,
			labelAssignmentsResult,
			relationsData,
			activityData,
			timeTrackingData,
			testingSessionsData,
			usersData,
			allLabelsData
		] = await Promise.all([
			fetchOptional(
				() => supabase.from('phwb_bug_comments').select('*').eq('bug_id', bugId).order('created_at', { ascending: true }),
				[]
			),
			fetchOptional(
				() => supabase.from('phwb_bug_attachments').select('*').eq('bug_id', bugId).order('created_at', { ascending: false }),
				[]
			),
			fetchOptional(
				() => supabase.from('phwb_bug_label_assignments').select('label_id, phwb_bug_labels(*)').eq('bug_id', bugId),
				[]
			),
			fetchOptional(
				async () => {
					const r = await supabase
						.from('phwb_bug_relations')
						.select('*, related_bug:phwb_bugs!related_bug_id(id, title, status, priority)')
						.eq('bug_id', bugId)
					if (r.error && (r.error as { code?: string }).code === 'PGRST200') {
						return { data: [] as any, error: null }
					}
					return r as { data: any; error: unknown }
				},
				[]
			),
			fetchOptional(
				() => supabase.from('phwb_bug_activity').select('*').eq('bug_id', bugId).order('created_at', { ascending: false }),
				[]
			),
			fetchOptional(
				() => supabase.from('phwb_bug_time_tracking').select('*').eq('bug_id', bugId).order('date', { ascending: false }),
				[]
			),
			fetchOptional(
				() => supabase.from('phwb_bug_testing_sessions').select('*').eq('bug_id', bugId).order('created_at', { ascending: false }),
				[]
			),
			fetchOptional(
				() => supabase.from('profiles').select('id, full_name, avatar_url').order('full_name', { ascending: true }),
				[]
			),
			fetchOptional(
				() => supabase.from('phwb_bug_labels').select('*').order('name', { ascending: true }),
				[]
			)
		])

		const commentsDataArr = Array.isArray(commentsData) ? commentsData : []
		const attachmentsDataArr = Array.isArray(attachmentsData) ? attachmentsData : []
		const labelAssignments = Array.isArray(labelAssignmentsResult) ? labelAssignmentsResult : []
		const relations = Array.isArray(relationsData) ? relationsData : []
		const activityDataArr = Array.isArray(activityData) ? activityData : []
		const timeTrackingDataArr = Array.isArray(timeTrackingData) ? timeTrackingData : []
		const testingSessionsDataArr = Array.isArray(testingSessionsData) ? testingSessionsData : []
		const users = Array.isArray(usersData) ? usersData : []
		const allLabels = Array.isArray(allLabelsData) ? allLabelsData : []

		// Build all user IDs for profile resolution
		const allUserIds = new Set<string>(Array.from(userIds))
		commentsDataArr.forEach((c: any) => { if (c?.user_id) allUserIds.add(c.user_id) })
		attachmentsDataArr.forEach((a: any) => { if (a?.uploaded_by) allUserIds.add(a.uploaded_by) })
		activityDataArr.forEach((act: any) => { if (act?.user_id) allUserIds.add(act.user_id) })
		timeTrackingDataArr.forEach((tt: any) => { if (tt?.user_id) allUserIds.add(tt.user_id) })

		let allProfilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
		if (allUserIds.size > 0) {
			try {
				const { data: allProfiles } = await supabase
					.from('profiles')
					.select('id, full_name, avatar_url')
					.in('id', Array.from(allUserIds))
				if (allProfiles) {
					allProfiles.forEach((p: any) => allProfilesMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url }))
				}
			} catch (_) {
				// non-fatal
			}
		}

		const comments = commentsDataArr.map((c: any) => ({
			...c,
			profiles: c?.user_id ? allProfilesMap.get(c.user_id) || null : null
		}))
		const attachments = attachmentsDataArr.map((a: any) => ({
			...a,
			profiles: a?.uploaded_by ? { full_name: allProfilesMap.get(a.uploaded_by)?.full_name || null } : null
		}))
		const activity = activityDataArr.map((act: any) => ({
			...act,
			profiles: act?.user_id ? allProfilesMap.get(act.user_id) || null : null
		}))
		const timeTracking = timeTrackingDataArr.map((tt: any) => ({
			...tt,
			profiles: tt?.user_id ? { full_name: allProfilesMap.get(tt.user_id)?.full_name || null } : null
		}))
		const testingSessions = testingSessionsDataArr.map((s: any) => ({
			...s,
			profiles: s?.tester_id ? { full_name: allProfilesMap.get(s.tester_id)?.full_name || null } : null
		}))

		const labels = (labelAssignments || [])
			.map((la: any) => (la && typeof la === 'object' && 'phwb_bug_labels' in la ? la.phwb_bug_labels : null))
			.filter(Boolean)

		// Replication screenshots (depends on bug.replication_data)
		let replicationScreenshots: any[] = []
		if (bug.replication_data && typeof bug.replication_data === 'object') {
			const rd = bug.replication_data as { screenshot_ids?: number[] }
			if (rd.screenshot_ids?.length) {
				try {
					const { data: repAttachments } = await supabase
						.from('phwb_bug_attachments')
						.select('*')
						.in('id', rd.screenshot_ids)
						.order('created_at', { ascending: true })
					if (repAttachments) {
						replicationScreenshots = repAttachments.map((att: any) => ({
							...att,
							profiles: att.uploaded_by ? { full_name: allProfilesMap.get(att.uploaded_by)?.full_name || null } : null
						}))
					}
				} catch (_) {
					// non-fatal
				}
			}
		}

		return {
			bug: bugWithProfiles,
			comments,
			attachments,
			labels,
			relations,
			activity,
			timeTracking,
			users,
			allLabels,
			replicationScreenshots,
			testingSessions
		}
	} catch (err) {
		console.error('Bug detail load error:', err)
		throw error(500, 'Failed to load bug details: ' + (err instanceof Error ? err.message : 'Unknown error'))
	}
}

export type BugDetailPageData = {
	bug: Bug & {
		profiles_reported?: { full_name: string | null; avatar_url: string | null } | null
		profiles_assigned?: { full_name: string | null; avatar_url: string | null } | null
		profiles_resolved?: { full_name: string | null } | null
		profiles_closed?: { full_name: string | null } | null
	}
	comments: Array<BugComment & { profiles?: { full_name: string | null; avatar_url: string | null } | null }>
	attachments: Array<BugAttachment & { profiles?: { full_name: string | null } | null }>
	labels: BugLabel[]
	relations: Array<any>
	activity: Array<BugActivity & { profiles?: { full_name: string | null; avatar_url: string | null } | null }>
	timeTracking: Array<BugTimeTracking & { profiles?: { full_name: string | null } | null }>
	users: Array<{ id: string; full_name: string | null; avatar_url: string | null }>
	allLabels: BugLabel[]
	replicationScreenshots: Array<BugAttachment & { profiles?: { full_name: string | null } | null }>
	testingSessions: Array<any>
}
