process.env.NODE_ENV = 'production';
process.env.TRAVEL_FOOTPRINT_PRODUCTION_ENTRY = 'true';

const { runServer, stopServer } = await import('../../server');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    void stopServer(signal)
      .catch((error) => {
        console.error('Failed to stop server cleanly', error);
        process.exitCode = 1;
      })
      .finally(() => clearTimeout(forceExit));
  });
}

await runServer();
