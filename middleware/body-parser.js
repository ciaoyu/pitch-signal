/**
 * POST body parser middleware — PitchSignal
 * Parses JSON POST body from incoming request.
 */
function parseBody(req, maxBytes = 1024 * 1024) {
  if (req.method !== 'POST') return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    let tooLarge = false;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        const error = new Error('Request body too large');
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (data.trim() === '') return resolve(null);
      try {
        resolve(JSON.parse(data));
      } catch {
        const err = new Error('Invalid JSON body');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = { parseBody };
