const request = require('supertest');
const app = require('../server/index');

describe('API Endpoints', () => {
  
  // Test Health Check
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      
      expect(res.body).toHaveProperty('status', 'OK');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  // Test Auth Endpoints
  describe('POST /api/auth/login', () => {
    it('should reject login without credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        })
        .expect(401);
      
      expect(res.body).toHaveProperty('error');
    });
  });

  // Test Protected Routes
  describe('GET /api/employees', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .get('/api/employees')
        .expect(401);
      
      expect(res.body).toHaveProperty('error');
    });
  });

  // Test Dashboard Endpoints
  describe('GET /api/dashboard/stats', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .expect(401);
      
      expect(res.body).toHaveProperty('error');
    });
  });

});

module.exports = app;
