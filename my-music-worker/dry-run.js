import worker from './src/index.js';

async function testFetch() {
    console.log("--- Testing my-music-worker Fetch Handler ---");
    const mockEnv = {
        SUPABASE_URL: "https://mock.supabase.co",
        SUPABASE_ANON_KEY: "mock_key",
        AI: {
            run: async (model, input) => {
                console.log(`   [Mock AI] Running model: ${model}`);
                console.log(`   [Mock AI] Input: ${JSON.stringify(input)}`);
                return new Uint8Array([1, 2, 3]).buffer; // Mock audio buffer
            }
        }
    };

    const mockReq = {
        method: 'POST',
        json: async () => ({
            text: "Hello from the test script"
        })
    };

    try {
        const response = await worker.fetch(mockReq, mockEnv);
        console.log("   [Response Status]:", response.status);
        console.log("   [Response Header Content-Type]:", response.headers.get('Content-Type'));
        const buffer = await response.arrayBuffer();
        console.log("   [Response Body Length]:", buffer.byteLength);
    } catch (err) {
        console.error("   [Fetch Error]:", err);
    }
}

testFetch();
