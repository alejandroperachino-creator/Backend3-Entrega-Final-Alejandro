import User from '../../src/models/user.model.js';
import Order from '../../src/models/order.model.js';
import Delivery from '../../src/models/delivery.model.js';
import {
  connectTestDatabase,
  disconnectTestDatabase,
  getTestMongoUri
} from '../helpers/testDatabase.js';

getTestMongoUri();

before(async () => {
  await connectTestDatabase();
});

beforeEach(async () => {
  await Promise.all([
    Delivery.deleteMany({}),
    Order.deleteMany({}),
    User.deleteMany({})
  ]);
});

after(async () => {
  await disconnectTestDatabase({ dropDatabase: true });
});
