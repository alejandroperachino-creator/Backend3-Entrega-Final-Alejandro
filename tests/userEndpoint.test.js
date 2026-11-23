import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import User from '../src/models/user.model.js';
import app from '../src/app.js';
import {
    connectTestDatabase,
    disconnectTestDatabase
} from './helpers/testDatabase.js';

function buildUser() {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    return {
        firstName: 'Jose',
        lastName: 'Perez',
        email: `jose.${unique}@example.com`,
        password: 'password123',
        role: 'user'
    };
}

describe('User Endpoint Tests', () => {
before(async () => {
    await connectTestDatabase();
});

beforeEach(async () => {
    await User.deleteMany({});
});

after(async () => {
    await User.deleteMany({});
    await disconnectTestDatabase();
});

it('POST /api/users crea un usuario', async () => {
    const response = await request(app).post('/api/users').send(buildUser());

    assert.equal(response.status, 201);
    assert.equal(response.body.status, 'success');
    assert.ok(response.body.payload?._id);
    assert.equal(response.body.payload.password, undefined);
});
});