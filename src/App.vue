<template>
  <main class="min-h-screen bg-base-200 p-6 text-base-content">
    <section class="mx-auto max-w-3xl space-y-6">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h1 class="card-title text-3xl">Electron + Vue + Bun</h1>
          <p class="opacity-80">
            Project is ready with Tailwind CSS and daisyUI.
          </p>
          <div class="card-actions justify-end">
            <button class="btn btn-primary">Primary</button>
            <button class="btn btn-outline">Secondary</button>
          </div>
        </div>
      </div>

      <div class="alert alert-info">
        <span>Run <code>bun run dev</code> to start renderer and Electron app.</span>
      </div>
    </section>
  </main>
</template>
