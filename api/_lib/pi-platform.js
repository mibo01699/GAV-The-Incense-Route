// ============================================
// GAV | Pi Platform API Client
// File: api/_lib/pi-platform.js
// ============================================
// Handles all communication with Pi Platform API.
// All requests verified server-side.
// No floats. No mocks. No fake responses.
// ============================================

'use strict';

// ============================================
// Configuration
// ============================================

const PI_API_BASE = process.env.PI_API_BASE || 'https://api.minepi.com';
const PI_API_KEY = process.env.PI_API_KEY || '';

// Timeouts (integer milliseconds)
const REQUEST_TIMEOUT_MS = 10000;

// ============================================
// Internal Helper: Fetch with Timeout
// ============================================

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(function() {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ============================================
// 1. Verify User Token
// ============================================
// Calls GET /v2/me with Bearer token.
// Returns: { ok, user: { uid, username } } or { ok, error }
// ============================================

async function verifyUserToken(accessToken) {
    // Validate input
    if (!accessToken || typeof accessToken !== 'string') {
        return {
            ok: false,
            status: 400,
            error: 'accessToken is required and must be a string'
        };
    }

    if (accessToken.length < 10 || accessToken.length > 500) {
        return {
            ok: false,
            status: 400,
            error: 'accessToken length is invalid'
        };
    }

    try {
        const response = await fetchWithTimeout(
            PI_API_BASE + '/v2/me',
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Accept': 'application/json'
                }
            },
            REQUEST_TIMEOUT_MS
        );

        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                error: 'Invalid or expired token'
            };
        }

        const user = await response.json();

        // Validate response structure
        if (!user || typeof user.uid !== 'string' || user.uid.length === 0) {
            return {
                ok: false,
                status: 500,
                error: 'Invalid user data from Pi Platform'
            };
        }

        if (typeof user.username !== 'string' || user.username.length === 0) {
            return {
                ok: false,
                status: 500,
                error: 'Invalid username from Pi Platform'
            };
        }

        return {
            ok: true,
            user: {
                uid: user.uid,
                username: user.username
            }
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            return {
                ok: false,
                status: 504,
                error: 'Pi Platform request timed out'
            };
        }
        return {
            ok: false,
            status: 500,
            error: 'Failed to reach Pi Platform'
        };
    }
}

// ============================================
// 2. Approve Payment
// ============================================
// Calls POST /v2/payments/:id/approve.
// Server-side approval — MANDATORY.
// ============================================

async function approvePayment(paymentId) {
    // Validate configuration
    if (!PI_API_KEY) {
        return {
            ok: false,
            status: 500,
            error: 'PI_API_KEY is not configured'
        };
    }

    // Validate input
    if (!paymentId || typeof paymentId !== 'string') {
        return {
            ok: false,
            status: 400,
            error: 'paymentId is required and must be a string'
        };
    }

    if (paymentId.length < 5 || paymentId.length > 200) {
        return {
            ok: false,
            status: 400,
            error: 'paymentId length is invalid'
        };
    }

    try {
        const response = await fetchWithTimeout(
            PI_API_BASE + '/v2/payments/' + encodeURIComponent(paymentId) + '/approve',
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Key ' + PI_API_KEY,
                    'Content-Type': 'application/json'
                }
            },
            REQUEST_TIMEOUT_MS
        );

        if (!response.ok) {
            const errorText = await response.text();
            return {
                ok: false,
                status: response.status,
                error: 'Pi approve failed: ' + errorText
            };
        }

        return {
            ok: true,
            paymentId: paymentId,
            status: 'APPROVED'
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            return {
                ok: false,
                status: 504,
                error: 'Pi approve timed out'
            };
        }
        return {
            ok: false,
            status: 500,
            error: 'Failed to approve payment'
        };
    }
}

// ============================================
// 3. Complete Payment
// ============================================
// Calls POST /v2/payments/:id/complete with txid.
// Server-side completion — MANDATORY.
// Handles already_completed gracefully.
// ============================================

async function completePayment(paymentId, txid) {
    // Validate configuration
    if (!PI_API_KEY) {
        return {
            ok: false,
            status: 500,
            error: 'PI_API_KEY is not configured'
        };
    }

    // Validate inputs
    if (!paymentId || typeof paymentId !== 'string') {
        return {
            ok: false,
            status: 400,
            error: 'paymentId is required and must be a string'
        };
    }

    if (!txid || typeof txid !== 'string') {
        return {
            ok: false,
            status: 400,
            error: 'txid is required and must be a string'
        };
    }

    if (paymentId.length < 5 || paymentId.length > 200) {
        return {
            ok: false,
            status: 400,
            error: 'paymentId length is invalid'
        };
    }

    if (txid.length < 5 || txid.length > 200) {
        return {
            ok: false,
            status: 400,
            error: 'txid length is invalid'
        };
    }

    try {
        const response = await fetchWithTimeout(
            PI_API_BASE + '/v2/payments/' + encodeURIComponent(paymentId) + '/complete',
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Key ' + PI_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ txid: txid })
            },
            REQUEST_TIMEOUT_MS
        );

        if (!response.ok) {
            const errorText = await response.text();

            // Handle already_completed as success (idempotency)
            if (errorText.indexOf('already_completed') !== -1) {
                return {
                    ok: true,
                    paymentId: paymentId,
                    txid: txid,
                    alreadyCompleted: true,
                    status: 'COMPLETED'
                };
            }

            return {
                ok: false,
                status: response.status,
                error: 'Pi complete failed: ' + errorText
            };
        }

        return {
            ok: true,
            paymentId: paymentId,
            txid: txid,
            alreadyCompleted: false,
            status: 'COMPLETED'
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            return {
                ok: false,
                status: 504,
                error: 'Pi complete timed out'
            };
        }
        return {
            ok: false,
            status: 500,
            error: 'Failed to complete payment'
        };
    }
}

// ============================================
// 4. Get Payment
// ============================================
// Calls GET /v2/payments/:id.
// Used to verify payment status.
// ============================================

async function getPayment(paymentId) {
    // Validate configuration
    if (!PI_API_KEY) {
        return {
            ok: false,
            status: 500,
            error: 'PI_API_KEY is not configured'
        };
    }

    // Validate input
    if (!paymentId || typeof paymentId !== 'string') {
        return {
            ok: false,
            status: 400,
            error: 'paymentId is required and must be a string'
        };
    }

    try {
        const response = await fetchWithTimeout(
            PI_API_BASE + '/v2/payments/' + encodeURIComponent(paymentId),
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Key ' + PI_API_KEY,
                    'Accept': 'application/json'
                }
            },
            REQUEST_TIMEOUT_MS
        );

        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                error: 'Payment not found'
            };
        }

        const payment = await response.json();

        return {
            ok: true,
            payment: payment
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            return {
                ok: false,
                status: 504,
                error: 'Pi get payment timed out'
            };
        }
        return {
            ok: false,
            status: 500,
            error: 'Failed to get payment'
        };
    }
}

// ============================================
// Exports
// ============================================

module.exports = {
    verifyUserToken: verifyUserToken,
    approvePayment: approvePayment,
    completePayment: completePayment,
    getPayment: getPayment
};