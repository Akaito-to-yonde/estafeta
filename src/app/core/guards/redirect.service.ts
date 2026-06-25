import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RedirectService {
  private url: string | null = null;

  setUrl(url: string): void {
    this.url = url;
  }

  consumeUrl(): string | null {
    const u = this.url;
    this.url = null;
    return u;
  }
}
