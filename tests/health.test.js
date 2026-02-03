const request = require('supertest');

// Mock the DB connection to avoid needing a real DB for health check tests
jest.mock('../Backend/DB/db', () => ({
  query: jest.fn().mockResolvedValue([[{ 1: 1 }]]), // mysql2 promise query returns [rows, fields]
  execute: jest.fn(),
  end: jest.fn(),
}));

// Mock auth-middleware to bypass checks if needed (though health check is public)
// We mock it just in case other parts of app init trigger middleware logic
jest.mock('../Backend/auth-middleware', () => ({
  authGuard: (req, res, next) => next(),
  adminGuard: (req, res, next) => next(),
}));

// Mock ICD and RxNorm to prevent top-level side effects (network calls, file reads)
// Must return a valid middleware function for app.use()
const mockRouter = (req, res, next) => next();
jest.mock('../Backend/icd', () => mockRouter);
jest.mock('../Backend/rxnorm', () => mockRouter);

const app = require('../Backend/app');

describe('Health Check Endpoint', () => {
  it('should return 200 and status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('time');
  });
});
