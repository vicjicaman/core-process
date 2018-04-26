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
  const cmd = cmds.join(';');

  const {error, stdout, stderr} = await Process.exec(cmd, {
    ...opts,
    maxBuffer: 1024 * 30000
  });

  if (error) {
    throw error;
  }

  return {stdout, stderr, cmd};
}

export const exists = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

export const spawn = (cmd, args, options, cnf = {}) => {
  const {onOutput, onError, dataRaw, onClose} = cnf;

  const ipr = Process.spawn(cmd, args, options);

  var childProcess = ipr.childProcess;
  spawnChildProccess.push(childProcess);

  childProcess.stdout.on('data', async function(data) {
    const strData = dataRaw
      ? data
      : data.toString()
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
