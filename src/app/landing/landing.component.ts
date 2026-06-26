import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonModule],
})
export class LandingComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isAuthenticated = computed(() => this.auth.session() !== null);

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (profile) {
        const home = profile.categoria === 'admin' ? '/admin/users' : '/calendar';
        void this.router.navigate([home], { replaceUrl: true });
      }
    });
  }
}
