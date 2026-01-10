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
		// Fetch bug without automatic joins
		// Use maybeSingle() to avoid throwing on 0 rows, then handle it ourselves
		const { data: bug, error: bugError } = await supabase
			.from('phwb_bugs')
			.select('*')
			.eq('id', bugId)
			.maybeSingle()

		// Handle errors (other than "not found")
		if (bugError) {
			// Check if it's a "no rows" error (bug doesn't exist or RLS blocking)
			if (bugError.code === 'PGRST116' || bugError.message?.includes('0 rows')) {
				throw error(404, 'Bug not found')
			}
			throw bugError
		}
		
		// If bug is null/undefined, it doesn't exist
		if (!bug) {
			throw error(404, 'Bug not found')
		}

		// Fetch profiles for reported_by, assigned_to, resolved_by, and closed_by
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

			if (profilesError) {
				console.warn('Failed to fetch profiles:', profilesError)
			} else if (profiles) {
				profiles.forEach((profile: any) => {
					profilesMap.set(profile.id, {
						full_name: profile.full_name,
						avatar_url: profile.avatar_url
					})
				})
			}
		}

		// Attach profile data to bug
		const bugWithProfiles = {
			...bug,
			profiles_reported: bug.reported_by ? profilesMap.get(bug.reported_by) || null : null,
			profiles_assigned: bug.assigned_to ? profilesMap.get(bug.assigned_to) || null : null,
			profiles_resolved: bug.resolved_by ? { full_name: profilesMap.get(bug.resolved_by)?.full_name || null } : null,
			profiles_closed: bug.closed_by ? { full_name: profilesMap.get(bug.closed_by)?.full_name || null } : null
		}

		// Fetch comments without automatic joins
		const { data: commentsData } = await supabase
			.from('phwb_bug_comments')
			.select('*')
			.eq('bug_id', bugId)
			.order('created_at', { ascending: true })

		// Fetch attachments without automatic joins
		const { data: attachmentsData } = await supabase
			.from('phwb_bug_attachments')
			.select('*')
			.eq('bug_id', bugId)
			.order('created_at', { ascending: false })

		// Fetch labels
		const { data: labelAssignments } = await supabase
			.from('phwb_bug_label_assignments')
			.select('label_id, phwb_bug_labels(*)')
			.eq('bug_id', bugId)

		// Fetch relations
		const { data: relations } = await supabase
			.from('phwb_bug_relations')
			.select('*, related_bug:related_bug_id(id, title, status, priority)')
			.eq('bug_id', bugId)

		// Fetch activity without automatic joins
		const { data: activityData } = await supabase
			.from('phwb_bug_activity')
			.select('*')
			.eq('bug_id', bugId)
			.order('created_at', { ascending: false })

		// Fetch time tracking without automatic joins
		const { data: timeTrackingData } = await supabase
			.from('phwb_bug_time_tracking')
			.select('*')
			.eq('bug_id', bugId)
			.order('date', { ascending: false })

		// Collect all user IDs from comments, attachments, activity, and time tracking
		const allUserIds = new Set<string>(Array.from(userIds))
		if (commentsData) {
			commentsData.forEach((comment: any) => {
				if (comment.user_id) allUserIds.add(comment.user_id)
			})
		}
		if (attachmentsData) {
			attachmentsData.forEach((attachment: any) => {
				if (attachment.uploaded_by) allUserIds.add(attachment.uploaded_by)
			})
		}
		if (activityData) {
			activityData.forEach((act: any) => {
				if (act.user_id) allUserIds.add(act.user_id)
			})
		}
		if (timeTrackingData) {
			timeTrackingData.forEach((tt: any) => {
				if (tt.user_id) allUserIds.add(tt.user_id)
			})
		}

		// Fetch all profiles at once
		let allProfilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
		if (allUserIds.size > 0) {
			const { data: allProfiles, error: allProfilesError } = await supabase
				.from('profiles')
				.select('id, full_name, avatar_url')
				.in('id', Array.from(allUserIds))

			if (allProfilesError) {
				console.warn('Failed to fetch all profiles:', allProfilesError)
			} else if (allProfiles) {
				allProfiles.forEach((profile: any) => {
					allProfilesMap.set(profile.id, {
						full_name: profile.full_name,
						avatar_url: profile.avatar_url
					})
				})
			}
		}

		// Attach profiles to comments
		const comments = (commentsData || []).map((comment: any) => ({
			...comment,
			profiles: comment.user_id ? allProfilesMap.get(comment.user_id) || null : null
		}))

		// Attach profiles to attachments
		const attachments = (attachmentsData || []).map((attachment: any) => ({
			...attachment,
			profiles: attachment.uploaded_by ? { full_name: allProfilesMap.get(attachment.uploaded_by)?.full_name || null } : null
		}))

		// Attach profiles to activity
		const activity = (activityData || []).map((act: any) => ({
			...act,
			profiles: act.user_id ? allProfilesMap.get(act.user_id) || null : null
		}))

		// Attach profiles to time tracking
		const timeTracking = (timeTrackingData || []).map((tt: any) => ({
			...tt,
			profiles: tt.user_id ? { full_name: allProfilesMap.get(tt.user_id)?.full_name || null } : null
		}))

		// Get all users for assignee dropdown
		const { data: users } = await supabase
			.from('profiles')
			.select('id, full_name, avatar_url')
			.order('full_name', { ascending: true })

		// Get all labels for label management
		const { data: allLabels } = await supabase
			.from('phwb_bug_labels')
			.select('*')
			.order('name', { ascending: true })

		// Fetch replication data and associated screenshots
		let replicationScreenshots: any[] = []
		if (bug.replication_data && typeof bug.replication_data === 'object') {
			const replicationData = bug.replication_data as { screenshot_ids?: number[] }
			if (replicationData.screenshot_ids && replicationData.screenshot_ids.length > 0) {
				const { data: repAttachments } = await supabase
					.from('phwb_bug_attachments')
					.select('*')
					.in('id', replicationData.screenshot_ids)
					.order('created_at', { ascending: true })

				if (repAttachments) {
					replicationScreenshots = repAttachments.map((att: any) => ({
						...att,
						profiles: att.uploaded_by ? { full_name: allProfilesMap.get(att.uploaded_by)?.full_name || null } : null
					}))
				}
			}
		}

		return {
			bug: bugWithProfiles,
			comments: comments || [],
			attachments: attachments || [],
			labels: (labelAssignments || []).map((la: any) => la.phwb_bug_labels).filter(Boolean),
			relations: relations || [],
			activity: activity || [],
			timeTracking: timeTracking || [],
			users: users || [],
			allLabels: allLabels || [],
			replicationScreenshots: replicationScreenshots || []
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
}
