import { extendTheme } from '@chakra-ui/react';
import { theme as saasTheme } from '@saas-ui/react';

export const rappiSaasTheme = extendTheme(
  {
    colors: {
      primary: {
        50: '#fff1ed',
        100: '#ffe0d6',
        200: '#ffbda8',
        300: '#ff9470',
        400: '#ff6840',
        500: '#ff441f',
        600: '#e83312',
        700: '#bf260c',
        800: '#991f0e',
        900: '#7c1f12',
      },
      rappiGreen: {
        50: '#effdf5',
        500: '#2ed477',
        600: '#18ad5b',
      },
    },
    fonts: {
      heading: 'Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    styles: {
      global: {
        body: {
          bg: 'white',
          color: 'gray.800',
        },
      },
    },
    components: {
      Card: {
        baseStyle: {
          container: {
            borderRadius: '8px',
            borderColor: 'gray.100',
            boxShadow: 'sm',
          },
        },
      },
    },
  },
  saasTheme,
);
