import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const bugId = parseInt(params.id, 10)
		if (isNaN(bugId)) {
			return json({ error: 'Invalid bug ID' }, { status: 400 })
		}

		// Use service role client to bypass RLS for LLM access
		const supabase = locals.supabaseAdmin || locals.supabase
		if (!supabase) {
			return json({ error: 'Database connection not available' }, { status: 500 })
		}

		// Verify bug exists
		const { data: bug, error: bugError } = await supabase
			.from('phwb_bugs')
			.select('id')
			.eq('id', bugId)
			.single()

		if (bugError || !bug) {
			return json({ error: 'Bug not found' }, { status: 404 })
		}

		// Parse multipart form data
		const formData = await request.formData()
		const report = formData.get('report') as string | null
		const screenshotFiles = formData.getAll('screenshots') as File[]

		if (!report) {
			return json({ error: 'Report is required' }, { status: 400 })
		}

		// Upload screenshots and create attachment records
		const screenshotIds: number[] = []
		
		for (const file of screenshotFiles) {
			if (file.size === 0) continue // Skip empty files
			
			try {
				const fileExt = file.name.split('.').pop() || 'png'
				const fileName = `${bugId}/replication/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
				const filePath = `bug-attachments/${fileName}`

				// Upload to Supabase Storage
				const { error: uploadError } = await supabase.storage
					.from('bug-attachments')
					.upload(filePath, file, {
						contentType: file.type || 'image/png',
						upsert: false
					})

				if (uploadError) {
					console.error('Failed to upload screenshot:', uploadError)
					continue // Skip this file but continue with others
				}

				// Create attachment record
				const { data: attachment, error: insertError } = await supabase
					.from('phwb_bug_attachments')
					.insert({
						bug_id: bugId,
						user_id: null, // LLM/system upload
						uploaded_by: null,
						file_name: file.name,
						file_path: filePath,
						file_size: file.size,
						mime_type: file.type || 'image/png'
					})
					.select('id')
					.single()

				if (insertError || !attachment) {
					console.error('Failed to create attachment record:', insertError)
					// Try to clean up uploaded file
					await supabase.storage.from('bug-attachments').remove([filePath])
					continue
				}

				screenshotIds.push(attachment.id)
			} catch (err) {
				console.error('Error processing screenshot:', err)
				// Continue with other screenshots
			}
		}

		// Update bug with replication data
		const replicationData = {
			report: report.trim(),
			screenshot_ids: screenshotIds
		}

		const { error: updateError } = await supabase
			.from('phwb_bugs')
			.update({ replication_data: replicationData })
			.eq('id', bugId)

		if (updateError) {
			console.error('Failed to update replication data:', updateError)
			return json({ error: 'Failed to save replication data' }, { status: 500 })
		}

		return json({ 
			success: true, 
			replication_data: replicationData,
			screenshots_uploaded: screenshotIds.length
		}, { status: 200 })
	} catch (err) {
		console.error('Unexpected error in replication endpoint:', err)
		return json({ error: 'Internal server error' }, { status: 500 })
	}
}
