const {bufferToString} = require('./browser-buffer-decode');

module.exports = async function* iterateStream(stream) {
  let contents = [];
  stream.on('data', data => contents.push(data));

  let resolveStreamEndedPromise;
  const streamEndedPromise = new Promise(resolve => (resolveStreamEndedPromise = resolve));

  let ended = false;
  stream.on('end', () => {
    ended = true;
    resolveStreamEndedPromise();
  });

  let error = false;
  stream.on('error', err => {
    error = err;
    resolveStreamEndedPromise();
  });

  while (!ended || contents.length > 0) {
    if (contents.length === 0) {
      stream.resume();
      // eslint-disable-next-line no-await-in-loop
      await Promise.race([once(stream, 'data'), streamEndedPromise]);
    } else {
      const isBuffer = Buffer.isBuffer(contents[0]);
      while (isBuffer) {
        const string = bufferToString(Buffer.concat(contents));
        if (string.includes('�') || ended) break;
        // eslint-disable-next-line no-await-in-loop
        await Promise.race([once(stream, 'data'), streamEndedPromise]);
      }
      stream.pause();
      let data;
      if (isBuffer) {
        data = Buffer.concat(contents);
        contents = [];
      } else {
        data = contents.shift();
      }
      yield data;
    }
    if (error) throw error;
  }
  resolveStreamEndedPromise();
};

function once(eventEmitter, type) {
  // TODO: Use require('events').once when node v10 is dropped
  return new Promise(resolve => {
    let fired = false;
    const handler = () => {
      if (!fired) {
        fired = true;
        eventEmitter.removeListener(type, handler);
        resolve();
      }
    };
    eventEmitter.addListener(type, handler);
  });
}
