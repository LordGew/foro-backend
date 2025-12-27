const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Configurar base de datos en memoria para tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// Limpiar base de datos después de cada test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

// Cerrar conexión después de todos los tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Configurar variables de entorno para tests
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
