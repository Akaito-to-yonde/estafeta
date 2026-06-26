import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { ES } from '../shared/i18n/es';

@Component({
  selector: 'app-admin-shell',
  templateUrl: './admin-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly labels = {
    users: ES.admin.usersTitle,
    logout: ES.auth.logoutButton,
  };

  protected async onSignOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/auth/login']);
  }
}
