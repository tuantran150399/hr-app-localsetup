process.on('uncaughtException', (error) => {
  console.error('Uncaught exception during API startup:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection during API startup:', reason);
});

require('./dist/main');
