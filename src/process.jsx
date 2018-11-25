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

export const exec = async (cmds, opts, cnf, cxt) => {
  const executionid = uuidv4();
  const cmd = cmds.join(';');
  const {onStreamFrame} = cnf;
  const metadata = JSON.stringify({
    executionid
  }, null, 2);

  onStreamFrame && onStreamFrame({
    metadata,
    type: "out",
    label: "cmd.exec",
    data: cmd
  }, cxt);

  let out = {};
  try {

    out = await Process.exec(cmd, {
      ...opts,
      maxBuffer: 1024 * 30000
    });

    onStreamFrame && onStreamFrame({
      metadata,
      type: "out",
      label: "cmd.out",
      data: out.stdout
    }, cxt);

    onStreamFrame && onStreamFrame({
      metadata,
      type: "warning",
      label: "cmd.err",
      data: out.stderr
    }, cxt);

    return out;
  } catch (e) {
    onStreamFrame && onStreamFrame({
      metadata,
      type: "error",
      label: "cmd.error",
      data: e.stderr
    }, cxt);

    throw e;
  } finally {
    onStreamFrame && onStreamFrame({
      metadata,
      type: "out",
      label: "cmd.code",
      data: out.code
    }, cxt);
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

export const spawn = function(cmd, args, options, cnf = {}, cxt) {
  const executionid = uuidv4();
  const {onOutput, onError, onClose, onStreamFrame} = cnf;
  const metadata = JSON.stringify({
    executionid
  }, null, 2);

  onStreamFrame && onStreamFrame({
    metadata,
    type: "out",
    label: "cmd.spawn",
    data: JSON.stringify({
      cmd,
      args
    }, null, 2)
  }, cxt);

  const ipr = Process.spawn(cmd, args, options);

  let childProcess = ipr.childProcess;

  childProcess.stdout.on('data', async function(raw) {
    const type = "out";
    const label = "cmd.out";
    const data = raw.toString();
    onStreamFrame && onStreamFrame({
      metadata,
      type,
      label,
      data
    }, cxt);

    onOutput && await onOutput({
      executionid,
      type,
      data,
      raw
    }, cxt);
  });

  childProcess.stderr.on('data', async function(raw) {
    const type = "warning";
    const label = "cmd.err";
    const data = raw.toString();
    onStreamFrame && onStreamFrame({
      metadata,
      type,
      label,
      data
    }, cxt);

    onOutput && await onOutput({
      executionid,
      type,
      data,
      raw
    }, cxt);

  });
  childProcess.on('error', async function(error) {
    const label = "cmd.error";
    const type = "error";

    onStreamFrame && onStreamFrame({
      metadata,
      label,
      type,
      data: error.toString()
    }, cxt);

    onError && await onError({
      executionid,
      error
    }, {cxt});
  });
  childProcess.on('close', async function(code) {
    const label = "cmd.close";
    const type = "out";

    onStreamFrame && onStreamFrame({
      metadata,
      label,
      type,
      data: code.toString()
    }, cxt);

    onClose && await onClose({
      executionid,
      code
    }, cxt);
  });

  return {promise: ipr, process: childProcess};
}
