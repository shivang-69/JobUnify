const mongoose = require('mongoose');
const { renderJobDetailPage, parseSalary, detectCategory } = require('./jobDetail');

describe('jobDetail module tests', () => {
  describe('detectCategory', () => {
    test('detects software-testing category', () => {
      expect(detectCategory({ title: 'Junior QA Tester' })).toBe('software-testing');
      expect(detectCategory({ title: 'SDET Intern' })).toBe('software-testing');
    });

    test('detects data-analytics category', () => {
      expect(detectCategory({ title: 'Junior Data Analyst' })).toBe('data-analytics');
      expect(detectCategory({ title: 'Data Science Intern' })).toBe('data-analytics');
    });

    test('detects design-ui-ux category', () => {
      expect(detectCategory({ title: 'UI/UX Designer' })).toBe('design-ui-ux');
      expect(detectCategory({ title: 'Product Design Intern' })).toBe('design-ui-ux');
    });

    test('defaults to software-developer for tech roles', () => {
      expect(detectCategory({ title: 'Frontend Developer' })).toBe('software-developer');
      expect(detectCategory({ title: 'Backend Node.js Engineer' })).toBe('software-developer');
      expect(detectCategory({})).toBe('software-developer');
    });
  });

  describe('parseSalary', () => {
    test('parses LPA annual salary', () => {
      const res = parseSalary('3.5 - 5 LPA');
      expect(res).toBeDefined();
      expect(res['@type']).toBe('MonetaryAmount');
      expect(res.value.unitText).toBe('YEAR');
      expect(res.value.minValue).toBe(350000);
      expect(res.value.maxValue).toBe(500000);
    });

    test('parses monthly stipend', () => {
      const res = parseSalary('₹ 15,000 /month');
      expect(res).toBeDefined();
      expect(res['@type']).toBe('MonetaryAmount');
      expect(res.value.unitText).toBe('MONTH');
      expect(res.value.minValue).toBe(15000);
      expect(res.value.maxValue).toBe(15000);
    });

    test('returns null for unpaid or not disclosed', () => {
      expect(parseSalary('Unpaid')).toBeNull();
      expect(parseSalary('Not disclosed')).toBeNull();
      expect(parseSalary('')).toBeNull();
      expect(parseSalary(null)).toBeNull();
    });
  });

  describe('renderJobDetailPage HTTP responses', () => {
    let mockReq, mockRes;

    beforeEach(() => {
      mockReq = { params: {} };
      mockRes = {
        statusCode: 200,
        headers: {},
        body: '',
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader(name, value) {
          this.headers[name] = value;
          return this;
        },
        send(data) {
          this.body = data;
          return this;
        }
      };
    });

    test('returns 410 Gone for invalid ObjectId', async () => {
      mockReq.params.id = 'invalid-id-123';
      await renderJobDetailPage(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(410);
      expect(mockRes.body).toContain('This job has expired');
      expect(mockRes.body).toContain('Browse All Active Jobs');
    });

    test('returns 410 Gone for nonexistent job', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      mockReq.params.id = nonExistentId;

      // Mock mongoose connection db if not connected
      if (!mongoose.connection || !mongoose.connection.db) {
        mongoose.connection.db = {
          collection: () => ({
            findOne: jest.fn().mockResolvedValue(null),
            find: () => ({
              sort: () => ({
                limit: () => ({
                  toArray: jest.fn().mockResolvedValue([])
                })
              })
            })
          })
        };
      }

      await renderJobDetailPage(mockReq, mockRes);
      expect(mockRes.statusCode).toBe(410);
      expect(mockRes.body).toContain('This job has expired');
    });

    test('returns 200 OK with JobPosting schema for active entry-level job', async () => {
      const validId = new mongoose.Types.ObjectId();
      mockReq.params.id = validId.toString();

      const fakeJob = {
        _id: validId,
        title: 'Junior React Developer',
        company: 'Acme Tech',
        location: 'Remote',
        source: 'GoogleJobs',
        date_posted: new Date().toISOString(),
        scrapedAt: new Date(),
        description: 'Exciting fresher React developer position with 0-1 years exp.',
        job_url: 'https://example.com/apply',
        stipend: '₹ 25,000 /month',
        min_experience: 0,
        is_broken: false
      };

      mongoose.connection.db = {
        collection: () => ({
          findOne: jest.fn().mockResolvedValue(fakeJob),
          find: () => ({
            sort: () => ({
              limit: () => ({
                toArray: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      };

      await renderJobDetailPage(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.body).toContain('Junior React Developer');
      expect(mockRes.body).toContain('Acme Tech');
      expect(mockRes.body).toContain(`https://www.jobunify.online/jobs/detail/${validId}`);
      expect(mockRes.body).toContain('"@type":"JobPosting"');
    });
  });
});
