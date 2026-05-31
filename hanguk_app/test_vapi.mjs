const vapiPublicKey = '5eb3a0e0-0b4a-4b75-bd3e-18cc95b90b46';
async function testVapi() {
  const payload = {
    assistant: {
      model: {
        provider: 'google',
        model: 'gemini-1.5-flash',
        messages: [{ role: 'system', content: 'You are a realistic interview simulator.' }]
      },
      voice: {
        provider: '11labs',
        voiceId: 'cgSgspJ2msm6clMCkdW9'
      },
      firstMessage: 'Hello, are you ready to begin our interview?'
    }
  };

  try {
    const response = await fetch('https://api.vapi.ai/call/web', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiPublicKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Status code:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testVapi();
