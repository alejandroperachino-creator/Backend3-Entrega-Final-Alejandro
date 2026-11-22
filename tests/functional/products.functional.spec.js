import { expect } from 'chai';
import request from 'supertest';
import Product from '../../src/models/product.model.js';
import app from '../../src/app.js';

describe('Functional - Products API', () => {
  beforeEach(async () => {
    await Product.deleteMany({});
  });

  afterEach(async () => {
    await Product.deleteMany({});
  });

  it('GET /api/products pagina los resultados y limita el tamaño máximo', async () => {
    await Product.create([
      { name: 'Producto A', price: 100, stock: 1 },
      { name: 'Producto B', price: 200, stock: 1 }
    ]);

    const firstPage = await request(app).get('/api/products?page=1&limit=1');
    const secondPage = await request(app).get('/api/products?page=2&limit=1');
    const oversizedPage = await request(app).get('/api/products?limit=101');

    expect(firstPage.status).to.equal(200);
    expect(firstPage.body.payload).to.have.length(1);
    expect(secondPage.status).to.equal(200);
    expect(secondPage.body.payload).to.have.length(1);
    expect(firstPage.body.payload[0]._id).to.not.equal(secondPage.body.payload[0]._id);
    expect(oversizedPage.status).to.equal(200);
    expect(oversizedPage.body.payload).to.have.length.at.most(100);
  });
});
