const url = 'https://www.adzuna.in/land/ad/5812528406?se=4tEZzgeM8RGltooVV8IVDA&utm_medium=api&utm_source=1f8a97d5&v=C61C40B384BB7D459DCF97941C30032FB58152C3'; // Real Adzuna link

async function testLinks() {
  // Test Adzuna
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    console.log(`Adzuna test: Status=${res.status}`);
  } catch(e) {
    console.log('Adzuna test error', e.message);
  }

  // Test Internshala
  try {
    const res2 = await fetch(internshalaUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const text = await res2.text();
    const isClosed = text.toLowerCase().includes('not found') || text.toLowerCase().includes('closed') || res2.status === 404;
    console.log(`Internshala test: Status=${res2.status}, isClosed=${isClosed}`);
  } catch(e) {
    console.log('Internshala test error', e.message);
  }
}

testLinks();
