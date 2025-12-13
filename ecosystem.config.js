module.exports = {
  apps: [{
    name: "artoria-bot",
    "version": "1.8.0",
    script: "./index.js",
    cwd: "/home/ubuntu/santstyle/artoriabot-v1.6",

    // Log settings
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "./logs/error.log",
    out_file: "./logs/out.log",
    log_file: "./logs/combined.log",

    // Restart settings
    autorestart: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: "10s",

    // Environment variables
    env: {
      NODE_ENV: "production",
      FFMPEG_PATH: "ffmpeg",
      FFPROBE_PATH: "ffprobe"
    },

    // Node.js options
    node_args: "--max-old-space-size=512",
    exec_mode: "fork",

    // Monitoring
    watch: false,
    ignore_watch: [
      "node_modules",
      "logs",
      "session",
      "temp",
      "tmp",
      ".git"
    ],

    // Memory limits
    max_memory_restart: "450M",

    // Timezone
    time: true
  }]
}
