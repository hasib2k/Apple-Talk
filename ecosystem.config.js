module.exports = {
  apps: [
    {
      name: 'mangotalk-api',
      script: './apps/api/dist/main.js',
      cwd: '/opt/mangotalk',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: './apps/api/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/mangotalk/api-error.log',
      out_file: '/var/log/mangotalk/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
