import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/app.js';
import { DELIVERY_STATUS, ORDER_STATUS, USER_ROLES } from '../../src/constants/index.js';

const createUserPayload = (role = USER_ROLES.USER) => {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return {
    firstName: 'Test',
    lastName: 'User',
    email: `test.${role}.${unique}@example.com`,
    password: 'Secret123!',
    role
  };
};

const createOrderPayload = (customerId) => ({
  customer: customerId,
  deliveryAddress: 'Calle Falsa 123',
  items: [{ name: 'Caja mediana', quantity: 1, price: 1000 }]
});

describe('Functional - Deliveries API', () => {
  it('POST /api/deliveries sin driver crea entrega pending y mantiene orden created', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const orderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));

    const response = await request(app)
      .post('/api/deliveries')
      .send({ order: orderResponse.body.payload._id });

    expect(response.status).to.equal(201);
    expect(response.body.status).to.equal('success');
    expect(response.body.payload.status).to.equal(DELIVERY_STATUS.PENDING);

    const orderAfterDelivery = await request(app).get(`/api/orders/${orderResponse.body.payload._id}`);
    expect(orderAfterDelivery.status).to.equal(200);
    expect(orderAfterDelivery.body.payload.status).to.equal(ORDER_STATUS.CREATED);
  });

  it('PUT /api/deliveries/:id falla si intenta ASSIGNED sin driver', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const orderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));
    const deliveryResponse = await request(app)
      .post('/api/deliveries')
      .send({ order: orderResponse.body.payload._id });

    const response = await request(app)
      .put(`/api/deliveries/${deliveryResponse.body.payload._id}`)
      .send({ status: DELIVERY_STATUS.ASSIGNED });

    expect(response.status).to.equal(400);
    expect(response.body.error.code).to.equal('BAD_REQUEST_ERROR');
    expect(response.body.error.message).to.include('repartidor');
  });

  it('PUT /api/deliveries/:id permite ASSIGNED con driver válido y sincroniza la orden', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const driverResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.DRIVER));
    const orderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));
    const deliveryResponse = await request(app)
      .post('/api/deliveries')
      .send({ order: orderResponse.body.payload._id });

    const updateResponse = await request(app)
      .put(`/api/deliveries/${deliveryResponse.body.payload._id}`)
      .send({
        status: DELIVERY_STATUS.ASSIGNED,
        driver: driverResponse.body.payload._id
      });

    expect(updateResponse.status).to.equal(200);
    expect(updateResponse.body.payload.status).to.equal(DELIVERY_STATUS.ASSIGNED);

    const orderAfterUpdate = await request(app).get(`/api/orders/${orderResponse.body.payload._id}`);
    expect(orderAfterUpdate.status).to.equal(200);
    expect(orderAfterUpdate.body.payload.status).to.equal(ORDER_STATUS.ASSIGNED);
  });

  it('PUT /api/deliveries/:id falla con transición inválida de PENDING a DELIVERED', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const driverResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.DRIVER));
    const orderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));
    const deliveryResponse = await request(app)
      .post('/api/deliveries')
      .send({ order: orderResponse.body.payload._id });

    const response = await request(app)
      .put(`/api/deliveries/${deliveryResponse.body.payload._id}`)
      .send({
        status: DELIVERY_STATUS.DELIVERED,
        driver: driverResponse.body.payload._id
      });

    expect(response.status).to.equal(400);
    expect(response.body.error.code).to.equal('BAD_REQUEST_ERROR');
    expect(response.body.error.message).to.include('Transición de estado inválida');
  });

  it('PUT /api/deliveries/:id no permite cambios luego de DELIVERED', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const driverResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.DRIVER));
    const orderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));
    const deliveryResponse = await request(app)
      .post('/api/deliveries')
      .send({ order: orderResponse.body.payload._id, driver: driverResponse.body.payload._id });

    const inTransitResponse = await request(app)
      .put(`/api/deliveries/${deliveryResponse.body.payload._id}`)
      .send({ status: DELIVERY_STATUS.IN_TRANSIT });
    expect(inTransitResponse.status).to.equal(200);

    const deliveredResponse = await request(app)
      .put(`/api/deliveries/${deliveryResponse.body.payload._id}`)
      .send({ status: DELIVERY_STATUS.DELIVERED });
    expect(deliveredResponse.status).to.equal(200);

    const rollbackResponse = await request(app)
      .put(`/api/deliveries/${deliveryResponse.body.payload._id}`)
      .send({ status: DELIVERY_STATUS.ASSIGNED });

    expect(rollbackResponse.status).to.equal(400);
    expect(rollbackResponse.body.error.code).to.equal('BAD_REQUEST_ERROR');
    expect(rollbackResponse.body.error.message).to.include('Transición de estado inválida');
  });

  it('POST /api/deliveries falla con driver inválido y no deja estado parcial en la orden', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const invalidDriverResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const orderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));

    const response = await request(app)
      .post('/api/deliveries')
      .send({
        order: orderResponse.body.payload._id,
        driver: invalidDriverResponse.body.payload._id
      });

    expect(response.status).to.equal(400);
    expect(response.body.error.code).to.equal('BAD_REQUEST_ERROR');
    expect(response.body.error.message).to.include('repartidor');

    const orderAfterFailedDelivery = await request(app).get(`/api/orders/${orderResponse.body.payload._id}`);
    expect(orderAfterFailedDelivery.status).to.equal(200);
    expect(orderAfterFailedDelivery.body.payload.status).to.equal(ORDER_STATUS.CREATED);
    expect(orderAfterFailedDelivery.body.payload.delivery).to.equal(null);

    const deliveriesResponse = await request(app).get('/api/deliveries');
    expect(deliveriesResponse.status).to.equal(200);
    expect(deliveriesResponse.body.payload).to.be.an('array').that.is.empty;
  });

  it('POST /api/deliveries responde 409 cuando la orden ya tiene entrega', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const orderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));

    const firstDeliveryResponse = await request(app)
      .post('/api/deliveries')
      .send({ order: orderResponse.body.payload._id });
    expect(firstDeliveryResponse.status).to.equal(201);

    const duplicatedDeliveryResponse = await request(app)
      .post('/api/deliveries')
      .send({ order: orderResponse.body.payload._id });

    expect(duplicatedDeliveryResponse.status).to.equal(409);
    expect(duplicatedDeliveryResponse.body.success).to.equal(false);
    expect(duplicatedDeliveryResponse.body.error.code).to.equal('RESOURCE_CONFLICT_ERROR');
  });

  it('GET /api/deliveries aplica paginación y filtros', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const driverResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.DRIVER));
    const firstOrderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));
    const secondOrderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));

    await request(app).post('/api/deliveries').send({ order: firstOrderResponse.body.payload._id });
    await request(app).post('/api/deliveries').send({
      order: secondOrderResponse.body.payload._id,
      driver: driverResponse.body.payload._id
    });

    const filteredResponse = await request(app)
      .get(`/api/deliveries?page=1&limit=1&status=${DELIVERY_STATUS.ASSIGNED}&driver=${driverResponse.body.payload._id}`);

    expect(filteredResponse.status).to.equal(200);
    expect(filteredResponse.body.status).to.equal('success');
    expect(filteredResponse.body.payload).to.be.an('array').with.length.at.most(1);
    expect(filteredResponse.body.payload[0].status).to.equal(DELIVERY_STATUS.ASSIGNED);
    const responseDriverId = filteredResponse.body.payload[0].driver?._id || filteredResponse.body.payload[0].driver;
    expect(String(responseDriverId)).to.equal(driverResponse.body.payload._id);
  });

  it('GET /api/deliveries/:id/tracking devuelve el estado y sus marcas de tiempo', async () => {
    const customerResponse = await request(app).post('/api/users').send(createUserPayload(USER_ROLES.USER));
    const orderResponse = await request(app).post('/api/orders').send(createOrderPayload(customerResponse.body.payload._id));
    const deliveryResponse = await request(app)
      .post('/api/deliveries')
      .send({ order: orderResponse.body.payload._id });

    const trackingResponse = await request(app)
      .get(`/api/deliveries/${deliveryResponse.body.payload._id}/tracking`);

    expect(trackingResponse.status).to.equal(200);
    expect(trackingResponse.body.payload).to.include({
      _id: deliveryResponse.body.payload._id,
      status: DELIVERY_STATUS.PENDING,
      assignedAt: null,
      deliveredAt: null
    });
  });
});
