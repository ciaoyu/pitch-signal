/**
 * Unified API Client for PitchSignal
 * 
 * Returns structured responses so callers can distinguish:
 *   - Success (data present)
 *   - No data / empty (valid response, nothing to show)
 *   - HTTP error (4xx/5xx with status code)
 *   - Network error (offline, DNS failure)
 *   - Timeout (request exceeded deadline)
 * 
 * Migration guide:
 *   Old: const data = await api('/api/foo'); if (!data) return;
 *   New: const { ok, data, error } = await API.get('/api/foo'); if (!ok) return;
 */

const API = (() => {
    // Status constants
    const STATUS = {
        OK: 'ok',
        EMPTY: 'empty',
        ERROR_HTTP: 'error_http',
        ERROR_NETWORK: 'error_network',
        ERROR_TIMEOUT: 'error_timeout',
        ERROR_PARSE: 'error_parse',
    };

    // Default timeout for different endpoint categories
    const TIMEOUT_DEFAULT = 8000;
    const TIMEOUT_LONG = 15000;  // for heavy endpoints (spatial, formation)

    /**
     * Build a structured response object.
     */
    function makeResult(status, data, error, statusCode, url, elapsed) {
        return {
            ok: status === STATUS.OK || status === STATUS.EMPTY,
            status,
            data: status === STATUS.OK ? data : null,
            error: error || null,
            statusCode: statusCode || null,
            url,
            elapsed,
            // Convenience: true when response has data to render
            hasData: status === STATUS.OK && data != null,
            // Convenience: true when the request failed (not just empty)
            isFailure: status === STATUS.ERROR_HTTP ||
                       status === STATUS.ERROR_NETWORK ||
                       status === STATUS.ERROR_TIMEOUT ||
                       status === STATUS.ERROR_PARSE,
        };
    }

    /**
     * Core request method.
     * 
     * @param {string} url - API endpoint path
     * @param {object} [options]
     * @param {string} [options.method='GET']
     * @param {object} [options.body] - will be JSON.stringify'd for POST
     * @param {object} [options.headers]
     * @param {number} [options.timeout=8000]
     * @param {number} [options.retries=0] - retry count for transient failures
     * @param {string} [options.cache='no-store']
     * @returns {Promise<object>} structured result
     */
    async function request(url, options = {}) {
        const {
            method = 'GET',
            body,
            headers = {},
            timeout = TIMEOUT_DEFAULT,
            retries = 0,
            cache = 'no-store',
        } = options;

        const start = Date.now();
        let lastError = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeout);

                const fetchOpts = {
                    method,
                    cache,
                    signal: controller.signal,
                    headers: { ...headers },
                };

                if (body !== undefined && method !== 'GET') {
                    fetchOpts.body = JSON.stringify(body);
                    if (!fetchOpts.headers['Content-Type']) {
                        fetchOpts.headers['Content-Type'] = 'application/json';
                    }
                }

                const res = await fetch(url, fetchOpts);
                clearTimeout(timer);
                const elapsed = Date.now() - start;

                // Handle HTTP errors
                if (!res.ok) {
                    let errorData = null;
                    try {
                        errorData = await res.json();
                    } catch { /* ignore parse failure on error responses */ }
                    const msg = errorData?.error || errorData?.message || `HTTP ${res.status}`;
                    return makeResult(STATUS.ERROR_HTTP, null, msg, res.status, url, elapsed);
                }

                // Parse response body
                let data = null;
                try {
                    data = await res.json();
                } catch {
                    return makeResult(STATUS.ERROR_PARSE, null, 'Invalid JSON response', res.status, url, elapsed);
                }

                // Check if the response is empty or explicitly an error in the body
                if (data === null || data === undefined) {
                    return makeResult(STATUS.EMPTY, null, null, res.status, url, elapsed);
                }

                // Some endpoints return { error: "..." } with HTTP 200
                if (data && typeof data === 'object' && data.error && !data.data) {
                    return makeResult(STATUS.ERROR_HTTP, null, data.error, res.status, url, elapsed);
                }

                return makeResult(STATUS.OK, data, null, res.status, url, elapsed);

            } catch (err) {
                const elapsed = Date.now() - start;
                lastError = err;

                if (err.name === 'AbortError') {
                    // Don't retry on timeout
                    return makeResult(STATUS.ERROR_TIMEOUT, null, 'Request timed out', null, url, elapsed);
                }

                // Network errors — retry if attempts remain
                if (attempt < retries) {
                    // Exponential backoff: 200ms, 400ms, ...
                    await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
                    continue;
                }

                return makeResult(STATUS.ERROR_NETWORK, null, err.message || 'Network error', null, url, elapsed);
            }
        }

        // Should not reach here, but safety net
        return makeResult(STATUS.ERROR_NETWORK, null, lastError?.message || 'Unknown error', null, url, Date.now() - start);
    }

    /**
     * GET request.
     */
    function get(url, options = {}) {
        return request(url, { ...options, method: 'GET' });
    }

    /**
     * POST request.
     */
    function post(url, body, options = {}) {
        return request(url, { ...options, method: 'POST', body });
    }

    /**
     * Convenience: fetch multiple endpoints in parallel, return array of results.
     * Each entry is { url, result } so callers can match results to requests.
     */
    async function all(requests) {
        const promises = requests.map(req => {
            if (typeof req === 'string') {
                return get(req).then(result => ({ url: req, result }));
            }
            return request(req.url, req.options || {}).then(result => ({ url: req.url, result }));
        });
        return Promise.all(promises);
    }

    /**
     * Convenience: fetch multiple URLs in parallel, return data array or null array.
     * Drop-in replacement for the common pattern:
     *   const [a, b, c] = await Promise.all([api(url1), api(url2), api(url3)])
     * 
     * Usage:
     *   const [a, b, c] = await API.allData(['/api/foo', '/api/bar', '/api/baz'])
     */
    async function allData(requests, options = {}) {
        const results = await all(requests);
        return results.map(({ result }) => result.ok ? result.data : null);
    }

    /**
     * Backward-compatible wrapper: returns raw data on success, null on failure.
     * Use this to gradually migrate existing api() calls without changing all callers at once.
     */
    async function legacy(url, options = {}) {
        const result = await request(url, options);
        return result.ok ? result.data : null;
    }

    // Public API
    return {
        STATUS,
        TIMEOUT_DEFAULT,
        TIMEOUT_LONG,
        request,
        get,
        post,
        all,
        allData,
        legacy,
    };
})();

// Freeze to prevent accidental mutation
Object.freeze(API.STATUS);
