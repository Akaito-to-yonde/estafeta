import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-50 flex flex-col">

      <header class="px-6 py-5">
        <a routerLink="/" class="inline-flex items-center gap-3 group" aria-label="Estafeta — Inicio">
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="w-8 h-8 shrink-0"
            aria-hidden="true"
          >
            <circle cx="20" cy="20" r="20" class="fill-brand-600" />
            <rect x="10" y="10" width="20" height="4" rx="2" fill="white" />
            <rect x="10" y="18" width="12" height="4" rx="2" fill="white" />
            <path d="M22 18 L30 20 L22 22 Z" fill="white" />
            <rect x="10" y="26" width="20" height="4" rx="2" fill="white" />
          </svg>
          <span class="text-lg font-bold text-slate-800 group-hover:text-brand-600 transition-colors duration-150">
            Estafeta
          </span>
        </a>
      </header>

      <main class="flex-1 flex items-center justify-center px-4 py-8">
        <router-outlet />
      </main>

    </div>
  `,
})
export class AuthShellComponent {}
