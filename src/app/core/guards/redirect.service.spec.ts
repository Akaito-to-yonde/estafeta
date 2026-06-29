import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import fc from 'fast-check';

import { RedirectService } from './redirect.service';
import { authGuard } from './auth.guard';
import { AuthService } from '../auth/auth.service';

// ---------------------------------------------------------------------------
// RedirectService — property-based tests (no TestBed needed)
// ---------------------------------------------------------------------------

describe('RedirectService', () => {
  // Property 30: Single-use URL store
  it('P30: consumeUrl returns the stored url once, then null', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (url) => {
        const svc = new RedirectService();
        svc.setUrl(url);

        const first = svc.consumeUrl();
        const second = svc.consumeUrl();

        expect(first).toBe(url);
        expect(second).toBeNull();
      }),
    );
  });

  // Property 31: setUrl overwrites; only the last-set URL is returned
  it('P31: setUrl overwrites previous value; consumeUrl returns last-set url then null', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 }),
        (urls) => {
          const svc = new RedirectService();

          for (const url of urls) {
            svc.setUrl(url);
          }

          const lastUrl = urls[urls.length - 1];
          const first = svc.consumeUrl();
          const second = svc.consumeUrl();

          expect(first).toBe(lastUrl);
          expect(second).toBeNull();
        },
      ),
    );
  });

  it('consumeUrl returns null when nothing has been set', () => {
    const svc = new RedirectService();
    expect(svc.consumeUrl()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// authGuard — unit tests (TestBed required for inject())
// ---------------------------------------------------------------------------

describe('authGuard', () => {
  let redirectService: RedirectService;
  let router: Router;

  const mockState = (url: string) => ({ url }) as Parameters<typeof authGuard>[1];

  const mockRoute = {} as Parameters<typeof authGuard>[0];

  function setup(sessionValue: Session | null) {
    TestBed.configureTestingModule({
      providers: [
        RedirectService,
        {
          provide: AuthService,
          useValue: { session: signal(sessionValue) },
        },
      ],
    });

    redirectService = TestBed.inject(RedirectService);
    router = TestBed.inject(Router);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('redirects to /auth/login and stores the url when session is null', () => {
    setup(null);

    const state = mockState('/protected/dashboard');
    let result!: ReturnType<typeof authGuard>;

    TestBed.runInInjectionContext(() => {
      result = authGuard(mockRoute, state);
    });

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/auth/login');
    expect(redirectService.consumeUrl()).toBe('/protected/dashboard');
  });

  it('returns true and does NOT call redirect.setUrl when session is non-null', () => {
    const fakeSession = { user: { id: 'u1' } } as Session;
    setup(fakeSession);

    const state = mockState('/protected/dashboard');
    let result!: ReturnType<typeof authGuard>;

    TestBed.runInInjectionContext(() => {
      result = authGuard(mockRoute, state);
    });

    expect(result).toBe(true);
    // consumeUrl must be null — setUrl was never called
    expect(redirectService.consumeUrl()).toBeNull();
  });
});
