import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';

const EstafetaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{violet.50}',
      100: '{violet.100}',
      200: '{violet.200}',
      300: '{violet.300}',
      400: '{violet.400}',
      500: '{violet.500}',
      600: '{violet.600}',
      700: '{violet.700}',
      800: '{violet.800}',
      900: '{violet.900}',
      950: '{violet.950}',
    },
    colorScheme: {
      light: {
        formField: {
          borderColor: 'oklch(85% 0.08 315)',
          hoverBorderColor: 'oklch(72% 0.14 315)',
          focusBorderColor: 'oklch(58% 0.21 315)',
          invalidBorderColor: '{red.500}',
          background: '{surface.0}',
          disabledBackground: '{surface.100}',
          disabledColor: '{surface.400}',
          placeholderColor: '{surface.400}',
          shadow: 'none',
          focusRing: {
            width: '0',
            style: 'none',
            color: 'transparent',
            offset: '0',
            shadow: '0 0 0 3px oklch(58% 0.21 315 / 0.2)',
          },
        },
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    providePrimeNG({
      theme: {
        preset: EstafetaPreset,
        options: {
          darkModeSelector: false,
          cssLayer: {
            name: 'primeng',
            order: 'tailwind-base, primeng, tailwind-utilities',
          },
        },
      },
    }),
  ],
};
