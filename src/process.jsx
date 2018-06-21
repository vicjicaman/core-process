import Process from 'child-process-promise';
import Promise from 'bluebird';
import fs from 'fs';

export function wait(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}

const spawnChildProccess = []

export const getSpawnChildren = () => spawnChildProccess

export async function retry(action, onError, max = 1, scale = 10) {
  const MAX_RETRIES = max;
  const SCALE = scale;
  let error = new Error("retry");
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await action(i);
    } catch (err) {
      error = err;
      const timeout = Math.pow(2, i) * SCALE;
      const keep = onError && onError(error, i, timeout);
      if (keep === false) {
        throw error;
      }

      await wait(timeout);
    }
  }

  throw error;
}

export const exec = async (cmds, opts, cnf = {}) => {
  const {retryOn} = cnf;
  const cmd = cmds.join(';');

  const execFn = async () => {
    const {error, stdout, stderr} = await Process.exec(cmd, {
      ...opts,
      maxBuffer: 1024 * 30000
    });

    if (error) {
      throw error;
    }

    return {stdout, stderr, cmd};
  }

  return await retry(execFn, (error, i, timeout) => {

    if (retryOn) {
      return retryOn(error, i, timeout);
    }

    return false;
  });

}

export const exists = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

export const spawn = function (cmd, args, options, cnf = {}) {
  const {onOutput, onError, dataRaw, onClose, logger} = cnf;

  const ipr = Process.spawn(cmd, args, options);

  let childProcess = ipr.childProcess;
  spawnChildProccess.push(childProcess);

  childProcess.stdout.on('data', async function(data) {
    const strData = dataRaw
      ? data
      : data.toString()

    if (logger) {
      logger.debug({source: "PROCESS", data: data.toString(), id: childProcess.id})
    }
    onOutput && await onOutput(strData, options);
  });
  childProcess.stderr.on('data', async function(data) {
    const strData = dataRaw
      ? data
      : data.toString()
    onError && await onError(strData, options);
  });
  childProcess.on('close', async function(code) {
    onClose && await onClose(code);
  });

  return {promise: ipr, process: childProcess};
}
