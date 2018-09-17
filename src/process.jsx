import Process from 'child-process-promise';
import Promise from 'bluebird';
import fs from 'fs';
const uuidv4 = require('uuid/v4');

export function wait(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}

export const getSpawnChildren = () => []

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

export const retryExec = async (cmds, opts, cnf = {}) => {
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

const addToContextStream = (streams, cmd, out) => streams.push({
  streamid: uuidv4(),
  typeid: "process.exec",
  origin: cmd,
  out: out.stdout,
  err: out.stderr,
  code: out.code
})

export const exec = async (cmds, opts, cnf = {}) => {
  const cmd = cmds.join(';');

  try {

    const out = await Process.exec(cmd, {
      ...opts,
      maxBuffer: 1024 * 30000
    });

    if (cnf.streams) {
      // Testing the device
      addToContextStream(cnf.streams, cmd, out)
    }

    return out;

  } catch (e) {

    if (cnf.streams) {
      // Testing the device
      addToContextStream(cnf.streams, cmd, e)
    }

    throw e;
  }

}

export const exists = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

export const spawn = function(cmd, args, options, cnf = {}) {
  const {onOutput, onError, dataRaw, onClose, logger} = cnf;

  const ipr = Process.spawn(cmd, args, options);

  let childProcess = ipr.childProcess;

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
