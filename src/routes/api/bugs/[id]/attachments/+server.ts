import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

const ATTACHMENT_BUCKET = 'bug-attachments'

async function ensureAttachmentBucket(supabase: any): Promise<{ ok: true } | { ok: false; message: string }> {
	const { data: bucket, error: bucketError } = await supabase.storage.getBucket(ATTACHMENT_BUCKET)
	if (!bucketError && bucket) return { ok: true }

	const raw = (bucketError?.message || '').toLowerCase()
	const isMissing = raw.includes('not found') || raw.includes('does not exist') || raw.includes('bucket')
	if (!isMissing) {
		return {
			ok: false,
			message: bucketError?.message || 'Failed to verify attachment storage bucket.'
		}
	}

	const { error: createError } = await supabase.storage.createBucket(ATTACHMENT_BUCKET, {
		public: true,
		fileSizeLimit: 20 * 1024 * 1024
	})
	if (createError) {
		const createMsg = createError?.message || 'Unknown bucket creation error'
		const alreadyExists = /already exists|duplicate/i.test(createMsg)
		if (!alreadyExists) {
			return {
				ok: false,
				message:
					`Storage bucket "${ATTACHMENT_BUCKET}" is missing and could not be auto-created. ` +
					`Please create it in Supabase Storage. Details: ${createMsg}`
			}
		}
	}
	return { ok: true }
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 })
	}

	const bugId = Number.parseInt(params.id, 10)
	if (!Number.isFinite(bugId)) {
		return json({ error: 'Invalid bug id' }, { status: 400 })
	}

	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		return json({ error: 'Database connection unavailable' }, { status: 500 })
	}

	try {
		const formData = await request.formData()
		const file = formData.get('file')
		const context = String(formData.get('context') || 'general').trim() || 'general'
		if (!(file instanceof File) || file.size === 0) {
			return json({ error: 'A non-empty file is required.' }, { status: 400 })
		}

		const ext = file.name.includes('.') ? file.name.split('.').pop() || 'bin' : 'bin'
		const safeContext = context.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)
		const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
		const storagePath = `${bugId}/${safeContext}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeFileName}`

		const bucketCheck = await ensureAttachmentBucket(supabase)
		if (!bucketCheck.ok) {
			return json({ error: bucketCheck.message }, { status: 500 })
		}

		const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, file, {
			contentType: file.type || `application/${ext}`,
			upsert: false
		})
		if (uploadError) {
			return json({ error: uploadError.message || 'Failed to upload file.' }, { status: 500 })
		}

		const { data: row, error: insertError } = await supabase
			.from('phwb_bug_attachments')
			.insert({
				bug_id: bugId,
				uploaded_by: locals.session.user.id,
				file_name: file.name,
				file_path: storagePath,
				file_size: file.size,
				mime_type: file.type || null
			})
			.select('id,file_name,file_path')
			.single()

		if (insertError) {
			await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath])
			const msg = insertError.message || 'Failed to save attachment.'
			if (/null value in column \"id\"|violates not-null constraint/i.test(msg)) {
				return json(
					{
						error:
							'Attachment schema is missing an auto-generated id default. Apply migration `024_fix_bug_attachments_id_default.sql` and retry.'
					},
					{ status: 500 }
				)
			}
			return json({ error: msg }, { status: 500 })
		}

		return json(
			{
				success: true,
				attachment_id: row?.id,
				file_name: row?.file_name || file.name,
				file_path: row?.file_path || storagePath
			},
			{ status: 200 }
		)
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Unexpected upload error'
		return json({ error: msg }, { status: 500 })
	}
}
