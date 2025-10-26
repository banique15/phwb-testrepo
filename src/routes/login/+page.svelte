<script lang="ts">
	import { authStore } from '$lib/auth'
	import { goto } from '$app/navigation'
	
	let email = ''
	let password = ''
	let loading = false
	let error = ''
	let isSignUp = false
	
	async function handleSubmit() {
		if (!email || !password) {
			error = 'Please fill in all fields'
			return
		}
		
		loading = true
		error = ''
		
		try {
			if (isSignUp) {
				await authStore.signUp(email, password)
				alert('Check your email for confirmation link!')
			} else {
				await authStore.signIn(email, password)
				goto('/')
			}
		} catch (err: any) {
			error = err.message
		} finally {
			loading = false
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200">
	<div class="card w-96 bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title justify-center">
				{isSignUp ? 'Sign Up' : 'Sign In'}
			</h2>
			
			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<div class="form-control">
					<label class="label" for="email">
						<span class="label-text">Email</span>
					</label>
					<input
						id="email"
						type="email"
						placeholder="Enter your email"
						class="input input-bordered"
						bind:value={email}
						required
					/>
				</div>
				
				<div class="form-control">
					<label class="label" for="password">
						<span class="label-text">Password</span>
					</label>
					<input
						id="password"
						type="password"
						placeholder="Enter your password"
						class="input input-bordered"
						bind:value={password}
						required
					/>
				</div>
				
				{#if error}
					<div class="alert alert-error">
						<span>{error}</span>
					</div>
				{/if}
				
				<div class="form-control mt-6">
					<button 
						type="submit" 
						class="btn btn-primary"
						class:loading
						disabled={loading}
					>
						{isSignUp ? 'Sign Up' : 'Sign In'}
					</button>
				</div>
			</form>
			
			<div class="divider">OR</div>
			
			<button 
				type="button"
				class="btn btn-ghost"
				on:click={() => { isSignUp = !isSignUp; error = '' }}
			>
				{isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
			</button>
		</div>
	</div>
</div>