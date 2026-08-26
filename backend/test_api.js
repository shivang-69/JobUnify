const fetch = require('node-fetch');

async function run() {
  const urls = [
    'https://www.adzuna.in/land/ad/5812528406?se=4tEZzgeM8RGltooVV8IVDA&utm_medium=api&utm_source=1f8a97d5&v=C61C40B384BB7D459DCF97941C30032FB58152C3', // Real Adzuna
    'https://www.adzuna.in/land/ad/0000000000', // Broken Adzuna
    'https://internshala.com/internship/detail/dummy-expired-internship123' // Broken Internshala
  ];

  try {
    const res = await fetch('http://localhost:5000/api/jobs/check-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    });
    
    const data = await res.json();
    console.log("API Response:", data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
