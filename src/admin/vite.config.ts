import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  return mergeConfig(config, {
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: [
        'cms.emermedia.eu',
        'localhost',
        '127.0.0.1'
      ],
      hmr: {
        host: 'cms.emermedia.eu',
        protocol: 'wss'
      }
    }
  });
};
