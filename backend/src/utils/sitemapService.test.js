const mongoose = require('mongoose');
const { generateSitemapXml } = require('./sitemapService');

describe('sitemapService unit tests', () => {
  test('generates valid sitemap with home, categories, and job detail URLs with lastmod', async () => {
    const fakeJobs = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Software Developer Fresher',
        company: 'Tech Innovations',
        location: 'Bangalore',
        source: 'GoogleJobs',
        date_posted: '2026-09-01',
        scrapedAt: new Date('2026-09-01T10:00:00Z'),
        min_experience: 0,
        is_broken: false
      },
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'QA Engineer 0-1 years',
        company: 'Quality Labs',
        location: 'Remote',
        source: 'Naukri',
        date_posted: '2026-09-05',
        scrapedAt: new Date('2026-09-05T10:00:00Z'),
        min_experience: 0,
        is_broken: false
      }
    ];

    mongoose.connection.db = {
      collection: () => ({
        find: () => ({
          sort: () => ({
            toArray: jest.fn().mockResolvedValue(fakeJobs)
          })
        })
      })
    };

    const xml = await generateSitemapXml();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://www.jobunify.online/</loc>');
    expect(xml).toContain('<loc>https://www.jobunify.online/jobs/software-developer</loc>');
    expect(xml).toContain('<loc>https://www.jobunify.online/jobs/software-testing</loc>');
    expect(xml).toContain('<loc>https://www.jobunify.online/jobs/data-analytics</loc>');
    expect(xml).toContain('<loc>https://www.jobunify.online/jobs/design-ui-ux</loc>');
    expect(xml).toContain('<loc>https://www.jobunify.online/jobs/remote</loc>');
    expect(xml).toContain(`<loc>https://www.jobunify.online/jobs/detail/${fakeJobs[0]._id}</loc>`);
    expect(xml).toContain(`<loc>https://www.jobunify.online/jobs/detail/${fakeJobs[1]._id}</loc>`);
    // Ensure lastmod exists
    expect(xml).toContain('<lastmod>');
    // Ensure no raw /api/ endpoints are in sitemap
    expect(xml).not.toContain('https://www.jobunify.online/api/jobs/detail');
  });
});
