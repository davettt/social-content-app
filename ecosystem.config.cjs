module.exports = {
  apps: [
    {
      name: 'social-content-app',
      script: 'server/index.js',
      node_args: '--experimental-modules',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
    },
  ],
};
