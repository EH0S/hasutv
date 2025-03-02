import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';
const ENDPOINT = '/api/auth/user';

async function testCORS() {
    console.log('Testing CORS configuration...\n');

    // Test 1: Allowed origin
    console.log('Test 1: Request from allowed origin (localhost:3000)');
    try {
        const response = await fetch(`${API_URL}${ENDPOINT}`, {
            headers: {
                'Origin': 'http://localhost:3000'
            }
        });
        console.log('Status:', response.status);
        console.log('CORS Headers:', {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
        });
    } catch (error) {
        console.error('Error:', error.message);
    }

    // Test 2: Disallowed origin
    console.log('\nTest 2: Request from disallowed origin (example.com)');
    try {
        const response = await fetch(`${API_URL}${ENDPOINT}`, {
            headers: {
                'Origin': 'https://example.com'
            }
        });
        console.log('Status:', response.status);
        console.log('CORS Headers:', {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
        });
    } catch (error) {
        console.error('Error:', error.message);
    }

    // Test 3: OPTIONS request (preflight)
    console.log('\nTest 3: OPTIONS request (preflight check)');
    try {
        const response = await fetch(`${API_URL}${ENDPOINT}`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        console.log('Status:', response.status);
        console.log('CORS Headers:', {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
            'Access-Control-Max-Age': response.headers.get('Access-Control-Max-Age')
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testCORS();
