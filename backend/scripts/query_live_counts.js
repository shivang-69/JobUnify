const http = require('https');

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    const defaultData = await getJSON('https://jobunify.onrender.com/api/jobs');
    const sortedData = await getJSON('https://jobunify.onrender.com/api/jobs?sort=newest');

    console.log('DEFAULT COUNT:', defaultData.total, defaultData.counts);
    console.log('SORTED COUNT:', sortedData.total, sortedData.counts);

    // Let's print the first 5 job titles of default
    console.log('\n--- Default first 5:');
    defaultData.jobs.slice(0, 5).forEach(j => console.log(`  - [${j.source}] ${j.title} (${j.posted_at || 'no posted_at'})`));

    // Let's print the first 5 job titles of sorted
    console.log('\n--- Sorted first 5:');
    sortedData.jobs.slice(0, 5).forEach(j => console.log(`  - [${j.source}] ${j.title} (${j.posted_at || 'no posted_at'})`));

  } catch (err) {
    console.error(err);
  }
}

run();
