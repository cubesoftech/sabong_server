//pm2 config file
module.exports = {
  apps: [
    {
      name: "server",
      script: "npm",
      args: "start",
      watch: true,
      ignore_watch: ["node_modules"],
      watch_options: {
        followSymlinks: false,
      },
    },
  ],
};
