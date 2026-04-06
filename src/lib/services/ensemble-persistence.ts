import type { ArtistAssignment } from '$lib/components/UnifiedArtistAssignment.svelte'
import type { Ensemble } from '$lib/schemas/ensemble'
import { supabase } from '$lib/supabase'

export interface PersistEventAssignmentsInput {
	assignments: ArtistAssignment[]
	ensembleName: string
	ensembleType?: string
	description?: string
	eventId?: number | null
	leaderArtistId?: string | null
}

export interface PersistEventAssignmentsResult {
	ensemble: Ensemble
	created: boolean
}

function normalizeAssignments(assignments: ArtistAssignment[]): ArtistAssignment[] {
	const seen = new Set<string>()
	return assignments.filter((assignment) => {
		if (!assignment?.artist_id || seen.has(assignment.artist_id)) {
			return false
		}
		seen.add(assignment.artist_id)
		return true
	})
}

function buildMemberSet(ids: string[]): Set<string> {
	return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))
}

function memberSetsAreEqual(left: Set<string>, right: Set<string>): boolean {
	if (left.size !== right.size) return false
	for (const id of left) {
		if (!right.has(id)) return false
	}
	return true
}

async function findExistingEnsembleByNameAndMembers(
	ensembleName: string,
	assignmentArtistIds: string[]
): Promise<Ensemble | null> {
	const expectedMembers = buildMemberSet(assignmentArtistIds)

	const { data: candidates, error: candidatesError } = await supabase
		.from('phwb_ensembles')
		.select('id, created_at, updated_at, name, description, ensemble_type, status, website, leader_id, instant_id')
		.eq('name', ensembleName)
		.neq('status', 'archived')
		.limit(20)

	if (candidatesError) throw candidatesError
	if (!candidates || candidates.length === 0) return null

	for (const candidate of candidates) {
		const { data: members, error: membersError } = await supabase
			.from('phwb_ensemble_members')
			.select('artist_id')
			.eq('ensemble_id', candidate.id)
			.eq('is_active', true)

		if (membersError) throw membersError

		const memberSet = buildMemberSet((members || []).map((member) => member.artist_id))
		if (memberSetsAreEqual(expectedMembers, memberSet)) {
			return candidate as Ensemble
		}
	}

	return null
}

export async function persistEventAssignmentsAsEnsemble(
	input: PersistEventAssignmentsInput
): Promise<PersistEventAssignmentsResult> {
	const normalizedAssignments = normalizeAssignments(input.assignments || [])
	if (normalizedAssignments.length < 2) {
		throw new Error('At least two artists are required to save an ensemble.')
	}

	const normalizedName = input.ensembleName?.trim()
	if (!normalizedName) {
		throw new Error('Ensemble name is required.')
	}

	const leaderArtistId =
		input.leaderArtistId ||
		normalizedAssignments.find((assignment) => assignment.is_bandleader)?.artist_id ||
		null

	const assignmentArtistIds = normalizedAssignments.map((assignment) => assignment.artist_id)
	const existing = await findExistingEnsembleByNameAndMembers(normalizedName, assignmentArtistIds)

	if (existing) {
		if (leaderArtistId && existing.leader_id !== leaderArtistId) {
			const { error: updateError } = await supabase
				.from('phwb_ensembles')
				.update({ leader_id: leaderArtistId })
				.eq('id', existing.id)
			if (updateError) throw updateError
			return {
				ensemble: { ...existing, leader_id: leaderArtistId },
				created: false
			}
		}
		return { ensemble: existing, created: false }
	}

	const descriptionParts = [input.description?.trim()].filter(Boolean)
	if (input.eventId) {
		descriptionParts.push(`Saved from event #${input.eventId}`)
	}

	const { data: createdEnsemble, error: createError } = await supabase
		.from('phwb_ensembles')
		.insert({
			name: normalizedName,
			ensemble_type: input.ensembleType || 'Band',
			description: descriptionParts.join(' | ') || null,
			status: 'active',
			leader_id: leaderArtistId
		})
		.select('id, created_at, updated_at, name, description, ensemble_type, status, website, leader_id, instant_id')
		.single()

	if (createError || !createdEnsemble) {
		throw createError || new Error('Failed to create ensemble.')
	}

	const memberRows = normalizedAssignments.map((assignment) => ({
		ensemble_id: createdEnsemble.id,
		artist_id: assignment.artist_id,
		role: assignment.role || (assignment.is_bandleader ? 'Bandleader' : null),
		joined_at: new Date().toISOString(),
		is_active: true
	}))

	const { error: memberInsertError } = await supabase.from('phwb_ensemble_members').insert(memberRows)
	if (memberInsertError) throw memberInsertError

	return {
		ensemble: createdEnsemble as Ensemble,
		created: true
	}
}
