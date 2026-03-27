import { defineConfig, loadEnv } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const oauthClientId = env.VITE_GOOGLE_EXTENSION_CLIENT_ID;

  const extensionManifest = oauthClientId
    ? {
        ...manifest,
        oauth2: {
          client_id: oauthClientId,
          scopes: ['openid', 'email', 'profile'],
        },
      }
    : manifest;

  return {
    plugins: [crx({ manifest: extensionManifest })],
    build: {
      minify: false,
      sourcemap: true,
    },
  };
});
