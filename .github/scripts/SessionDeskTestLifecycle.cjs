// Shared by the browser regression and its dependency-free failure checks.
async function requestJson(url, { body, headers = {}, timeoutMs = 3000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('SessionDesk request deadline exceeded');
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(async () => {
        const response = await fetchImpl(url, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal
        });
        return { status: response.status, data: await response.json() };
      }),
      deadline
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function assertCleanServerExit(server) {
  if (server.exitCode !== 0 || server.signalCode) {
    throw new Error(`SessionDesk test service exit was not clean (code ${server.exitCode}, signal ${server.signalCode || 'none'})`);
  }
}

async function stopOwnedServer(server, shutdown, { attempts = 100, intervalMs = 50, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!server) return;
  if (server.exitCode !== null || server.signalCode) {
    assertCleanServerExit(server);
    return;
  }
  let requestError;
  try { await shutdown(); } catch (error) { requestError = error; }
  for (let i = 0; i < attempts && server.exitCode === null && !server.signalCode; i++) await delay(intervalMs);
  if (server.exitCode === null && !server.signalCode) {
    server.unref();
    throw new Error(`SessionDesk test service exit unconfirmed (owned pid ${server.pid})`, { cause: requestError });
  }
  if (requestError) throw requestError;
  assertCleanServerExit(server);
}

async function finishCleanup(primaryError, actions, { timeoutMs = 9000 } = {}) {
  const failures = [];
  for (const action of actions) {
    let timer;
    try {
      await Promise.race([
        Promise.resolve().then(action),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('SessionDesk cleanup deadline exceeded; exit remains unconfirmed')), timeoutMs);
        })
      ]);
    } catch (error) { failures.push(error); }
    finally { clearTimeout(timer); }
  }
  if (primaryError) {
    if (failures.length) throw new AggregateError([primaryError, ...failures], primaryError.message, { cause: primaryError });
    throw primaryError;
  }
  if (failures.length) throw new AggregateError(failures, 'SessionDesk test cleanup failed');
}

module.exports = { requestJson, stopOwnedServer, finishCleanup };
