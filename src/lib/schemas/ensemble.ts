import { z } from 'zod'

export const ensembleSchema = z.object({
	id: z.string().uuid().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	name: z.string().min(1, 'Name is required'),
	description: z.string().optional(),
	ensemble_type: z.string().min(1, 'Ensemble type is required'),
	status: z.enum(['active', 'inactive', 'archived']).optional(),
	website: z.string().url('Invalid URL format').optional(),
	leader_id: z.string().uuid().optional(),
	instant_id: z.string().optional(),
})

export const ensembleMemberSchema = z.object({
	id: z.string().uuid().optional(),
	created_at: z.string().optional(),
	ensemble_id: z.string().uuid(),
	artist_id: z.string().uuid(),
	joined_at: z.string().optional(),
	left_at: z.string().optional(),
	role: z.string().optional(),
	is_active: z.boolean().optional(),
})

export const createEnsembleSchema = ensembleSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateEnsembleSchema = createEnsembleSchema.partial()

export type Ensemble = z.infer<typeof ensembleSchema>
export type EnsembleMember = z.infer<typeof ensembleMemberSchema>
export type CreateEnsemble = z.infer<typeof createEnsembleSchema>
export type UpdateEnsemble = z.infer<typeof updateEnsembleSchema>
