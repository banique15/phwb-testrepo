<script lang="ts">
  import { onMount } from 'svelte'
  import { BellRing, Loader2, Mail, RefreshCw, RotateCcw, Save, Send, Settings, X } from 'lucide-svelte'
  import { supabase } from '$lib/supabase'
  import { type NotificationTemplate, type NotificationPolicy, type NotificationRun } from '$lib/schemas'
  import { notificationTemplatesStore } from '$lib/stores/notification-templates'
  import { notificationPoliciesStore } from '$lib/stores/notification-policies'

  type ModalTab = 'preview' | 'fields' | 'template' | 'settings' | 'test'

  const notificationTypeLabels: Record<string, string> = {
    artist_added_to_system: 'Artist Added To System',
    artist_added_to_event_invited: 'Artist Invited To Event',
    artist_invitation_reminder: 'Invitation Reminder',
    artist_booking_confirmation: 'Booking Confirmation',
    artist_contract_signature_request: 'Contract Signature Request',
    artist_contract_signature_reminder: 'Contract Signature Reminder',
    artist_briefing_packet: 'Artist Briefing Packet',
    artist_pre_event_reminder_48h: 'Pre-Event Reminder (48h)',
    artist_pre_event_reminder_24h: 'Pre-Event Reminder (24h)',
    artist_accepted_invitation: 'Artist Accepted Invitation',
    artist_declined_invitation: 'Artist Declined Invitation',
    booking_request_received_admin: 'Booking Request Received (Admin)',
    booking_confirmed_admin: 'Booking Confirmed (Admin)',
    partner_requested_artist_not_found_admin: 'Partner Requested Artist Not Found (Admin)',
    artist_event_starting_reminder: 'Event Starting Reminder',
    artist_thank_you_after_completed: 'Thank You After Event',
    artist_feedback_request: 'Post-Event Feedback Request',
    artist_payout_processed: 'Payout Processed'
  }

  const configuredLogoUrl = (import.meta.env.PUBLIC_NOTIFICATION_LOGO_URL as string | undefined)?.trim()
  const defaultLogoUrl = configuredLogoUrl || 'https://dummyimage.com/280x80/0f766e/ffffff.png&text=Sing+for+Hope'

  const sampleTokens: Record<string, string> = {
    artist_name: 'Alex Rivera',
    artist_email: 'alex@example.com',
    logo_url: defaultLogoUrl,
    event_title: 'Healing Arts at Bellevue',
    event_date: 'Apr 8, 2026',
    event_start_time: '4:00 PM',
    event_contact_name: 'Jordan Smith',
    event_contact_phone: '(555) 123-4567',
    facility_name: 'Bellevue Hospital',
    arrival_instructions: 'Please check in at the main desk 20 minutes early.',
    compensation_amount: '$350.00',
    payout_date: 'Apr 30, 2026',
    contract_link: 'https://example.com/sign-contract',
    feedback_form_link: 'https://example.com/feedback',
    accept_link: 'https://phwb.app/respond/accept',
    decline_link: 'https://phwb.app/respond/decline'
  }

  const modalTabs: { id: ModalTab; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'fields', label: 'Fields' },
    { id: 'template', label: 'Template' },
    { id: 'settings', label: 'Settings' },
    { id: 'test', label: 'Test Email' }
  ]

  const adminNotificationTypes = new Set([
    'artist_accepted_invitation',
    'artist_declined_invitation',
    'booking_request_received_admin',
    'booking_confirmed_admin',
    'partner_requested_artist_not_found_admin'
  ])

  let loading = $state(true)
  let savingChanges = $state(false)
  let sendingTestEmail = $state(false)
  let error = $state<string | null>(null)
  let successMessage = $state<string | null>(null)

  let templates = $state<NotificationTemplate[]>([])
  let policies = $state<NotificationPolicy[]>([])
  let notificationRuns = $state<NotificationRun[]>([])
  let dispatchingRuns = $state(false)
  let runActionLoadingId = $state<string | null>(null)

  let isModalOpen = $state(false)
  let activeTab = $state<ModalTab>('preview')
  let selectedTemplateId = $state<string | null>(null)

  let editorName = $state('')
  let editorSubject = $state('')
  let editorBody = $state('')
  let editorFields = $state('')
  let editorEnabled = $state(true)
  let editorInitialDelay = $state(0)
  let editorMaxAttempts = $state(3)
  let editorDunningRules = $state('[]')
  let editorStopConditions = $state('accepted, declined, manual_resolved')
  let testRecipientEmail = $state('')

  const selectedTemplate = $derived(templates.find((template) => template.id === selectedTemplateId) ?? null)
  const artistTemplates = $derived(
    templates.filter((template) => !adminNotificationTypes.has(template.notification_type))
  )
  const adminTemplates = $derived(
    templates.filter((template) => adminNotificationTypes.has(template.notification_type))
  )
  const selectedPolicy = $derived(
    selectedTemplate ? (policies.find((policy) => policy.notification_type === selectedTemplate.notification_type) ?? null) : null
  )
  const previewSubject = $derived(interpolateTemplate(editorSubject, sampleTokens))
  const previewBody = $derived(interpolateTemplate(editorBody, sampleTokens))

  onMount(async () => {
    await loadData()
  })

  async function loadData() {
    loading = true
    error = null
    successMessage = null

    try {
      const [templateResult, policyResult] = await Promise.all([
        notificationTemplatesStore.fetchAll({ limit: 200, sortBy: 'notification_type', sortOrder: 'asc' }),
        notificationPoliciesStore.fetchAll({ limit: 200, sortBy: 'notification_type', sortOrder: 'asc' })
      ])

      templates = templateResult.data
      policies = policyResult.data
      await loadNotificationRuns()

      if (!selectedTemplateId && templates.length > 0) {
        selectedTemplateId = templates[0].id ?? null
      }

      if (selectedTemplateId) {
        const nextTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null
        hydrateEditors(nextTemplate)
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load notification settings'
    } finally {
      loading = false
    }
  }

  async function loadNotificationRuns() {
    const { data: runRows, error: runError } = await supabase
      .from('phwb_notification_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (runError) throw runError
    notificationRuns = (runRows as NotificationRun[]) || []
  }

  function hydrateEditors(template: NotificationTemplate | null) {
    if (!template) {
      editorName = ''
      editorSubject = ''
      editorBody = ''
      editorFields = ''
      return
    }

    editorName = template.name
    editorSubject = template.subject_template
    editorBody = template.body_template
    editorFields = (template.available_fields || []).join(', ')

    const policy = policies.find((item) => item.notification_type === template.notification_type) ?? null
    if (policy) {
      editorEnabled = policy.enabled
      editorInitialDelay = policy.initial_delay_minutes
      editorMaxAttempts = policy.max_attempts
      editorDunningRules = JSON.stringify(policy.dunning_rules || [], null, 2)
      editorStopConditions = (policy.stop_conditions || []).join(', ')
    } else {
      editorEnabled = true
      editorInitialDelay = 0
      editorMaxAttempts = 3
      editorDunningRules = '[]'
      editorStopConditions = 'accepted, declined, manual_resolved'
    }
  }

  function openTemplateModal(template: NotificationTemplate) {
    selectedTemplateId = template.id ?? null
    activeTab = 'preview'
    testRecipientEmail = ''
    hydrateEditors(template)
    isModalOpen = true
  }

  function closeTemplateModal() {
    isModalOpen = false
  }

  async function persistTemplate() {
    if (!selectedTemplate?.id) return
    const availableFields = editorFields
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)

    await notificationTemplatesStore.update(selectedTemplate.id, {
      name: editorName.trim(),
      subject_template: editorSubject.trim(),
      body_template: editorBody.trim(),
      available_fields: availableFields,
      updated_at: new Date().toISOString()
    })
  }

  async function persistPolicy() {
    if (!selectedTemplate?.id) return
    const parsedRules = JSON.parse(editorDunningRules || '[]')
    const stopConditions = editorStopConditions
      .split(',')
      .map((condition) => condition.trim())
      .filter(Boolean)

    if (selectedPolicy?.id) {
      await notificationPoliciesStore.update(selectedPolicy.id, {
        enabled: editorEnabled,
        initial_delay_minutes: editorInitialDelay,
        max_attempts: editorMaxAttempts,
        dunning_rules: parsedRules,
        stop_conditions: stopConditions,
        updated_at: new Date().toISOString()
      })
    } else {
      await notificationPoliciesStore.create({
        template_id: selectedTemplate.id,
        notification_type: selectedTemplate.notification_type,
        enabled: editorEnabled,
        trigger_event: selectedTemplate.notification_type,
        initial_delay_minutes: editorInitialDelay,
        dunning_rules: parsedRules,
        max_attempts: editorMaxAttempts,
        stop_conditions: stopConditions,
        quiet_hours: {}
      })
    }
  }

  async function saveAllChanges() {
    if (!selectedTemplate?.id) return

    savingChanges = true
    error = null
    successMessage = null

    try {
      await persistTemplate()
      await persistPolicy()
      successMessage = 'Changes saved'
      await loadData()
      closeTemplateModal()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save changes'
    } finally {
      savingChanges = false
    }
  }

  async function sendTestEmail() {
    if (!selectedTemplate?.id || !testRecipientEmail.trim()) {
      error = 'Please enter a recipient email address'
      return
    }

    sendingTestEmail = true
    error = null
    successMessage = null

    try {
      const { error: insertError } = await supabase.from('phwb_notification_runs').insert([
        {
          template_id: selectedTemplate.id,
          policy_id: selectedPolicy?.id ?? null,
          notification_type: selectedTemplate.notification_type,
          recipient_email: testRecipientEmail.trim(),
          recipient_name: 'Test Recipient',
          status: 'pending',
          scheduled_for: new Date().toISOString(),
          attempt_count: 0,
          max_attempts: 1,
          dedupe_key: `test:${selectedTemplate.id}:${Date.now()}`,
          rendered_subject: previewSubject,
          rendered_body: previewBody,
          payload: {
            test: true,
            source: 'notification-settings-ui'
          }
        }
      ])

      if (insertError) throw insertError

      successMessage = 'Test email queued'
      await loadData()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to queue test email'
    } finally {
      sendingTestEmail = false
    }
  }

  async function dispatchPendingRuns() {
    dispatchingRuns = true
    error = null
    successMessage = null
    try {
      const response = await fetch('/api/notifications/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ limit: 25 })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to dispatch pending runs')
      }
      successMessage = `Dispatch processed ${payload.processed || 0} run(s)`
      await loadNotificationRuns()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to dispatch pending runs'
    } finally {
      dispatchingRuns = false
    }
  }

  async function retryRun(runId: string) {
    runActionLoadingId = runId
    error = null
    successMessage = null
    try {
      const response = await fetch(`/api/notifications/runs/${runId}/retry`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to retry run')
      successMessage = 'Run queued for retry'
      await loadNotificationRuns()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to retry run'
    } finally {
      runActionLoadingId = null
    }
  }

  async function cancelRun(runId: string) {
    runActionLoadingId = runId
    error = null
    successMessage = null
    try {
      const response = await fetch(`/api/notifications/runs/${runId}/cancel`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Failed to cancel run')
      successMessage = 'Run cancelled'
      await loadNotificationRuns()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to cancel run'
    } finally {
      runActionLoadingId = null
    }
  }

  function interpolateTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_match, key) => values[key] ?? '')
  }

  function formatDate(value?: string | null): string {
    if (!value) return '-'
    return new Date(value).toLocaleString()
  }

  function isNotificationEnabled(notificationType: string): boolean {
    return policies.find((policy) => policy.notification_type === notificationType)?.enabled ?? false
  }

  function canRetryRun(status: string | undefined) {
    return status === 'failed' || status === 'cancelled'
  }

  function canCancelRun(status: string | undefined) {
    return status === 'pending' || status === 'scheduled' || status === 'sending'
  }
</script>

<svelte:head>
  <title>Notification Settings | PHWB</title>
</svelte:head>

<div class="h-full overflow-y-auto">
<div class="container mx-auto p-6 pb-10 max-w-7xl">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-3">
      <Settings class="w-8 h-8 text-primary" />
      <div>
        <h1 class="text-2xl font-bold">Artist Notification Settings</h1>
        <p class="text-base-content/60">Select a template to open preview, fields, template code, settings, and test email.</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn btn-outline btn-sm" onclick={dispatchPendingRuns} disabled={dispatchingRuns}>
        {#if dispatchingRuns}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
        {:else}
          <Send class="w-4 h-4 mr-2" />
        {/if}
        Dispatch Pending
      </button>
      <button class="btn btn-outline btn-sm" onclick={loadData}>
        <RefreshCw class="w-4 h-4 mr-2" />
        Refresh
      </button>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error mb-4"><span>{error}</span></div>
  {/if}
  {#if successMessage}
    <div class="alert alert-success mb-4"><span>{successMessage}</span></div>
  {/if}

  {#if loading}
    <div class="flex justify-center py-14"><Loader2 class="w-8 h-8 animate-spin text-primary" /></div>
  {:else}
    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title"><BellRing class="w-5 h-5" /> Artist Notifications</h2>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Type</th>
                <th>Status</th>
                <th>Updated</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each artistTemplates as template}
                <tr>
                  <td class="font-medium">{template.name}</td>
                  <td>{notificationTypeLabels[template.notification_type] || template.notification_type}</td>
                  <td>
                    <span class="badge badge-sm {isNotificationEnabled(template.notification_type) ? 'badge-success' : 'badge-ghost'}">
                      {isNotificationEnabled(template.notification_type) ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>{formatDate(template.updated_at || template.created_at)}</td>
                  <td class="text-right">
                    <button class="btn btn-sm btn-primary" onclick={() => openTemplateModal(template)}>Open</button>
                  </td>
                </tr>
              {/each}
              {#if artistTemplates.length === 0}
                <tr><td colspan="5" class="text-base-content/60">No artist notifications configured.</td></tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title"><BellRing class="w-5 h-5" /> Admin Notifications</h2>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Type</th>
                <th>Status</th>
                <th>Updated</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each adminTemplates as template}
                <tr>
                  <td class="font-medium">{template.name}</td>
                  <td>{notificationTypeLabels[template.notification_type] || template.notification_type}</td>
                  <td>
                    <span class="badge badge-sm {isNotificationEnabled(template.notification_type) ? 'badge-success' : 'badge-ghost'}">
                      {isNotificationEnabled(template.notification_type) ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>{formatDate(template.updated_at || template.created_at)}</td>
                  <td class="text-right">
                    <button class="btn btn-sm btn-primary" onclick={() => openTemplateModal(template)}>Open</button>
                  </td>
                </tr>
              {/each}
              {#if adminTemplates.length === 0}
                <tr><td colspan="5" class="text-base-content/60">No admin notifications configured.</td></tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-xl mt-6">
      <div class="card-body">
        <h2 class="card-title">Notification Runs</h2>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Type</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Scheduled</th>
                <th>Last Error</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each notificationRuns as run}
                <tr>
                  <td>{notificationTypeLabels[run.notification_type] || run.notification_type}</td>
                  <td>{run.recipient_email}</td>
                  <td><span class="badge badge-outline badge-sm">{run.status}</span></td>
                  <td>{run.attempt_count || 0}/{run.max_attempts || 3}</td>
                  <td>{formatDate(run.scheduled_for || run.next_attempt_at)}</td>
                  <td class="max-w-xs truncate" title={run.last_error || ''}>{run.last_error || '-'}</td>
                  <td class="text-right">
                    <div class="flex justify-end gap-2">
                      {#if canRetryRun(run.status)}
                        <button
                          class="btn btn-xs btn-outline"
                          onclick={() => retryRun(run.id!)}
                          disabled={runActionLoadingId === run.id}
                        >
                          <RotateCcw class="w-3 h-3 mr-1" />
                          Retry
                        </button>
                      {/if}
                      {#if canCancelRun(run.status)}
                        <button
                          class="btn btn-xs btn-outline btn-error"
                          onclick={() => cancelRun(run.id!)}
                          disabled={runActionLoadingId === run.id}
                        >
                          Cancel
                        </button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
              {#if notificationRuns.length === 0}
                <tr><td colspan="7" class="text-base-content/60">No notification runs found.</td></tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>
</div>

{#if isModalOpen && selectedTemplate}
  <div class="modal modal-open">
    <div class="modal-box max-w-6xl p-0">
      <div class="p-4 border-b border-base-300 flex items-center justify-between">
        <div>
          <h3 class="text-xl font-semibold">{editorName || selectedTemplate.name}</h3>
          <p class="text-xs text-base-content/60">{notificationTypeLabels[selectedTemplate.notification_type] || selectedTemplate.notification_type}</p>
        </div>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={closeTemplateModal}><X class="w-4 h-4" /></button>
      </div>

      <div class="px-4 pt-3 border-b border-base-300">
        <div class="tabs tabs-bordered">
          {#each modalTabs as tab}
            <button
              type="button"
              class="tab {activeTab === tab.id ? 'tab-active' : ''}"
              onclick={() => (activeTab = tab.id)}
            >
              {tab.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="p-4 max-h-[70vh] overflow-y-auto space-y-4">
        {#if activeTab === 'preview'}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Subject</span></label>
              <input class="input input-bordered w-full" bind:value={editorSubject} />
            </div>
          </div>

          <div class="rounded-lg border border-base-300 bg-base-100 p-4">
            <p class="font-semibold mb-3">{previewSubject || '(No subject)'}</p>
            <div class="prose max-w-none text-sm" style="--tw-prose-body: hsl(var(--bc));">
              {@html previewBody || '<p>(No body content)</p>'}
            </div>
          </div>
        {/if}

        {#if activeTab === 'fields'}
          <div class="form-control">
            <label class="label"><span class="label-text">Available Custom Fields</span></label>
            <textarea class="textarea textarea-bordered min-h-24" bind:value={editorFields}></textarea>
            <label class="label"><span class="label-text-alt">Comma separated. Example: artist_name, event_title, event_date</span></label>
          </div>
          <div class="flex flex-wrap gap-2">
            {#each editorFields.split(',').map((field) => field.trim()).filter(Boolean) as field}
              <span class="badge badge-outline badge-sm">{`{{${field}}}`}</span>
            {/each}
          </div>
        {/if}

        {#if activeTab === 'template'}
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <label class="md:col-span-2 pt-2 text-sm text-base-content/70">Template Name</label>
            <div class="md:col-span-10">
              <input class="input input-bordered w-full" bind:value={editorName} />
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <label class="md:col-span-2 pt-2 text-sm text-base-content/70">Subject template</label>
            <div class="md:col-span-10">
              <textarea class="textarea textarea-bordered min-h-20 font-mono text-xs w-full" bind:value={editorSubject}></textarea>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <label class="md:col-span-2 pt-2 text-sm text-base-content/70">Body template (HTML)</label>
            <div class="md:col-span-10">
              <textarea class="textarea textarea-bordered min-h-56 font-mono text-xs w-full" bind:value={editorBody}></textarea>
            </div>
          </div>
        {/if}

        {#if activeTab === 'settings'}
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <label class="md:col-span-2 text-sm text-base-content/70">Enable this notification</label>
            <div class="md:col-span-10">
              <label class="label cursor-pointer justify-start gap-3">
                <input type="checkbox" class="toggle toggle-primary" bind:checked={editorEnabled} />
                <span class="label-text">Enabled</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <label class="md:col-span-2 pt-2 text-sm text-base-content/70">Initial Delay (minutes)</label>
            <div class="md:col-span-3">
              <input type="number" class="input input-bordered w-full" bind:value={editorInitialDelay} />
            </div>
            <label class="md:col-span-2 pt-2 text-sm text-base-content/70">Max Attempts</label>
            <div class="md:col-span-3">
              <input type="number" min="1" class="input input-bordered w-full" bind:value={editorMaxAttempts} />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <label class="md:col-span-2 pt-2 text-sm text-base-content/70">Dunning Rules JSON</label>
            <div class="md:col-span-10">
              <textarea class="textarea textarea-bordered min-h-28 font-mono text-xs w-full" bind:value={editorDunningRules}></textarea>
              <div class="text-xs text-base-content/60 mt-1">Example: {'[{"offset_minutes": 4320}, {"offset_minutes": 10080}]'}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <label class="md:col-span-2 pt-2 text-sm text-base-content/70">Stop Conditions</label>
            <div class="md:col-span-10">
              <input class="input input-bordered w-full" bind:value={editorStopConditions} />
            </div>
          </div>
        {/if}

        {#if activeTab === 'test'}
          <div class="form-control">
            <label class="label"><span class="label-text">Send test email to</span></label>
            <input type="email" class="input input-bordered" placeholder="name@example.com" bind:value={testRecipientEmail} />
          </div>
          <button class="btn btn-primary btn-sm" onclick={sendTestEmail} disabled={sendingTestEmail}>
            {#if sendingTestEmail}
              <Loader2 class="w-4 h-4 mr-2 animate-spin" />
            {:else}
              <Mail class="w-4 h-4 mr-2" />
            {/if}
            Send Test Email
          </button>
        {/if}
      </div>

      <div class="p-4 border-t border-base-300 flex items-center justify-between">
        <button class="btn btn-ghost" onclick={closeTemplateModal}>Cancel</button>
        <button class="btn btn-primary" onclick={saveAllChanges} disabled={savingChanges}>
          {#if savingChanges}
            <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          {:else}
            <Save class="w-4 h-4 mr-2" />
          {/if}
          Save Changes
        </button>
      </div>
    </div>
    <div class="modal-backdrop bg-black/50" onclick={closeTemplateModal}></div>
  </div>
{/if}
