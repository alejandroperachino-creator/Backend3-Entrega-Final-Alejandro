import test from 'node:test';
import assert from 'node:assert/strict';
import UserRepository from '../src/repositories/user.repository.js';
import User from '../src/models/user.model.js';
import {
    connectTestDatabase,
    disconnectTestDatabase
} from './helpers/testDatabase.js';
const userRepository = new UserRepository();

function buildUserData(overrides = {}) {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    return {
        firstName: 'Jose',
        lastName: 'Perez',
        email: `jose.${unique}@gmail.com`,
        password: 'password123',
        ...overrides
    };
}

async function clearUsers() {
    await User.deleteMany({});
}

test.before(async () => {
    await connectTestDatabase();
});

test.beforeEach(async () => {
    await clearUsers();
});

test.after(async () => {
    await clearUsers();
    await disconnectTestDatabase();
});

test('create crea un usuario y omite password en la respuesta', async () => {
    const created = await userRepository.create(buildUserData());

    assert.ok(created?._id);
    assert.equal(created.password, undefined);
    assert.equal(created.__v, undefined);
});

test('findByEmail encuentra usuario ignorando mayúsculas y espacios', async () => {
    const userData = buildUserData({ email: 'juan.perez@gmail.com' });
    await userRepository.create(userData);

    const found = await userRepository.findByEmail('  JUAN.PEREZ@GMAIL.COM  ');

    assert.ok(found?._id);
    assert.equal(found.email, 'juan.perez@gmail.com');
});

test('findById devuelve usuario sin password', async () => {
    const created = await userRepository.create(buildUserData());

    const found = await userRepository.findById(created._id);

    assert.ok(found?._id);
    assert.equal(found.password, undefined);
});

test('findRawById devuelve usuario con password', async () => {
    const userData = buildUserData();
    const created = await userRepository.create(userData);

    const foundRaw = await userRepository.findRawById(created._id);

    assert.ok(foundRaw?._id);
    assert.equal(foundRaw.password, userData.password);
});

test('findAll aplica filtro y omite password', async () => {
    await userRepository.create(buildUserData({ role: 'user' }));
    await userRepository.create(buildUserData({ role: 'admin' }));

    const admins = await userRepository.findAll({ filter: { role: 'admin' } });

    assert.equal(admins.length, 1);
    assert.equal(admins[0].role, 'admin');
    assert.equal(admins[0].password, undefined);
});

test('updateById actualiza y devuelve documento sin password', async () => {
    const created = await userRepository.create(buildUserData({ firstName: 'Jose' }));

    const updated = await userRepository.updateById(created._id, { firstName: 'Pedro' });

    assert.ok(updated?._id);
    assert.equal(updated.firstName, 'Pedro');
    assert.equal(updated.password, undefined);
});

test('deleteById elimina el usuario', async () => {
    const created = await userRepository.create(buildUserData());

    const deleted = await userRepository.deleteById(created._id);
    const foundAfterDelete = await userRepository.findRawById(created._id);

    assert.ok(deleted?._id);
    assert.equal(foundAfterDelete, null);
});