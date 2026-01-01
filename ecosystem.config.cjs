module.exports = {
  apps: [
    {
      name: 'social-content-app',
      script: 'server/index.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3003,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
    },
  ],
};
