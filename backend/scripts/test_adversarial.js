const { isEntryLevel } = require('../src/utils/experienceFilter');

const testCases = [
  {
    name: 'Adversarial 1: Senior Lead with mentoring year mention',
    job: {
      title: 'Senior Engineering Lead',
      description: 'We are looking for a senior lead to manage our engineering teams through our 2025 product roadmap. Experience mentoring a batch of junior developers is required.',
      source: 'GoogleJobs'
    },
    expected: 'senior'
  },
  {
    name: 'Adversarial 2: Lead role mentioning graduates/year in different contexts',
    job: {
      title: 'Lead Software Developer (Node.js)',
      description: 'Candidates must have 8+ years of experience. We hire graduates from top universities every year, including the upcoming 2026 batch.',
      source: 'GoogleJobs'
    },
    expected: 'senior'
  },
  {
    name: 'Adversarial 3: Standard developer title with senior requirements and unrelated year',
    job: {
      title: 'Software Engineer',
      description: 'Requirements: 6 years of experience in Java. Our office was established in 2024. Excellent benefits package.',
      source: 'GoogleJobs'
    },
    expected: 'senior'
  },
  {
    name: 'Real Case: Micron Software Engineer 2026',
    job: {
      title: 'Micron Software Engineer 2026 | PMO | Hyderabad — Apply Now',
      description: 'Micron Software Engineer 2026 is hiring for the Project Management Office (PMO) team in Hyderabad. Micron, a world leader in memory and storage solutions, is looking for software engineers skilled in SQL, Snowflake and data reporting to support PMO processes. This Micron Software Engineer 2026 role is a great opportunity for IS / IT / CS graduates who enjoy data, automation and reporting.',
      source: 'GoogleJobs'
    },
    expected: 'entry_level'
  }
];

console.log('RUNNING ADVERSARIAL TESTS ON ISENTRYLEVEL:\n');
let failed = false;

for (const tc of testCases) {
  const result = isEntryLevel(tc.job);
  console.log(`Test: "${tc.name}"`);
  console.log(`  Actual Status:   "${result.status}"`);
  console.log(`  Expected Status: "${tc.expected}"`);
  
  if (result.status === tc.expected) {
    console.log('  Result: PASS ✅');
  } else {
    console.log('  Result: FAIL ❌');
    failed = true;
  }
  console.log();
}

if (failed) {
  process.exit(1);
} else {
  console.log('All tests passed successfully!');
}
